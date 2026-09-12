"""
API endpoints for the wardrobe.

The security rule that runs through this whole file: every queryset starts with
`.filter(owner=self.request.user)`. There is no endpoint anywhere that can
return another person's clothes, even if someone guesses an item's id.
"""

from __future__ import annotations

import logging

from django.db import transaction
from django.db.models import Count, Q, Sum
from drf_spectacular.utils import extend_schema
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.intelligence.colors import name_for_hex
from apps.vision import storage
from apps.vision.background import remove_background

from .filters import GarmentItemFilter
from .models import Category, GarmentItem, StorageLocation
from .serializers import (
    BulkLocationSerializer,
    CategorySerializer,
    GarmentItemListSerializer,
    GarmentItemSerializer,
    ImageUploadRequestSerializer,
    ImageUploadResponseSerializer,
    MarkWornSerializer,
    StorageLocationSerializer,
    StorageLocationTreeSerializer,
)

logger = logging.getLogger(__name__)

# Phone photos are big, but 12 MB is already generous for a picture of a shirt.
MAX_UPLOAD_BYTES = 12 * 1024 * 1024
ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"}


# ===========================================================================
#  CATEGORIES
# ===========================================================================

@extend_schema(tags=["Wardrobe"])
class CategoryViewSet(viewsets.ModelViewSet):
    """
    Built-in categories plus this user's own custom ones.

    Built-ins (owner = NULL) are read-only: nobody may rename "Shirt" for
    everybody else.
    """

    serializer_class = CategorySerializer
    # Only so the docs generator can see the model; get_queryset() is what runs.
    queryset = Category.objects.none()

    def get_queryset(self):
        return (
            Category.objects.filter(Q(owner__isnull=True) | Q(owner=self.request.user))
            .annotate(
                item_count=Count("items", filter=Q(items__owner=self.request.user))
            )
            .order_by("sort_order", "name")
        )

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

    def _guard_system_category(self, instance: Category):
        if instance.is_system:
            raise ValidationError("Built-in categories cannot be changed or deleted.")

    def perform_update(self, serializer):
        self._guard_system_category(serializer.instance)
        serializer.save()

    def perform_destroy(self, instance):
        self._guard_system_category(instance)
        if instance.items.exists():
            raise ValidationError(
                "This category still has items in it. Move them first, then delete it."
            )
        instance.delete()


# ===========================================================================
#  STORAGE LOCATIONS
# ===========================================================================

@extend_schema(tags=["Wardrobe"])
class StorageLocationViewSet(viewsets.ModelViewSet):
    """
    The physical map of where things live.

    Ordinary list/create/update/delete, plus a /tree/ endpoint that returns the
    whole hierarchy nested, which is what the Storage page draws.
    """

    serializer_class = StorageLocationSerializer
    queryset = StorageLocation.objects.none()

    def get_queryset(self):
        return (
            StorageLocation.objects.filter(owner=self.request.user)
            .select_related("parent")
            .annotate(item_count=Count("items"))
        )

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

    def perform_destroy(self, instance: StorageLocation):
        """
        Deleting a wardrobe deletes the drawers inside it (the model says
        CASCADE), but the CLOTHES inside those drawers survive - they just lose
        their location (the item model says SET_NULL). Losing a shelf must never
        mean losing the record of a jacket.
        """
        instance.delete()

    @extend_schema(
        summary="Whole storage hierarchy, nested",
        responses=StorageLocationTreeSerializer(many=True),
    )
    @action(detail=False, methods=["get"])
    def tree(self, request):
        roots = (
            StorageLocation.objects.filter(owner=request.user, parent__isnull=True)
            .prefetch_related("children__children__children", "items")
            .order_by("name")
        )
        return Response(
            StorageLocationTreeSerializer(roots, many=True, context={"request": request}).data
        )

    @extend_schema(summary="Items stored in this location and everything inside it")
    @action(detail=True, methods=["get"])
    def items(self, request, pk=None):
        location = self.get_object()
        qs = (
            GarmentItem.objects.filter(
                owner=request.user, storage_location_id__in=location.descendant_ids()
            )
            .select_related("category", "storage_location")
            .order_by("name")
        )
        return Response(
            GarmentItemListSerializer(qs, many=True, context={"request": request}).data
        )


# ===========================================================================
#  GARMENT ITEMS
# ===========================================================================

@extend_schema(tags=["Wardrobe"])
class GarmentItemViewSet(viewsets.ModelViewSet):
    """Everything you own."""

    queryset = GarmentItem.objects.none()
    filterset_class = GarmentItemFilter
    search_fields = ["name", "brand", "notes", "category__name", "primary_color_name"]
    ordering_fields = ["created_at", "name", "wear_count", "last_worn_date", "purchase_price"]
    ordering = ["-created_at"]

    def get_queryset(self):
        return (
            GarmentItem.objects.filter(owner=self.request.user)
            .select_related("category", "storage_location", "storage_location__parent")
        )

    def get_serializer_class(self):
        # The grid gets the light serializer, everything else the full one.
        if self.action == "list":
            return GarmentItemListSerializer
        return GarmentItemSerializer

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

    def perform_destroy(self, instance: GarmentItem):
        """Remove the item's images from Cloudinary too, so we don't pay to store orphans."""
        for public_id in (instance.clean_image_public_id, instance.original_image_public_id):
            if public_id:
                storage.delete_image(public_id)
        instance.delete()

    # -- actions ------------------------------------------------------------

    @extend_schema(summary="Log that this item was worn", request=MarkWornSerializer)
    @action(detail=True, methods=["post"], url_path="mark-worn")
    def mark_worn(self, request, pk=None):
        item = self.get_object()
        payload = MarkWornSerializer(data=request.data)
        payload.is_valid(raise_exception=True)

        item.mark_worn(payload.validated_data.get("date"))
        return Response(GarmentItemSerializer(item, context={"request": request}).data)

    @extend_schema(summary="Move between 'In wardrobe' and 'In the wash'")
    @action(detail=True, methods=["post"], url_path="toggle-laundry")
    def toggle_laundry(self, request, pk=None):
        item = self.get_object()

        if item.status == GarmentItem.Status.IN_LAUNDRY:
            item.status = GarmentItem.Status.IN_WARDROBE
        elif item.status == GarmentItem.Status.IN_WARDROBE:
            item.status = GarmentItem.Status.IN_LAUNDRY
        else:
            # Lent out, for sale or sold - the laundry toggle makes no sense
            raise ValidationError(
                f"This item is currently '{item.get_status_display()}', so it cannot go to the wash."
            )

        item.save(update_fields=["status", "updated_at"])
        return Response(GarmentItemSerializer(item, context={"request": request}).data)

    @extend_schema(summary="Add or remove from favourites")
    @action(detail=True, methods=["post"], url_path="toggle-favorite")
    def toggle_favorite(self, request, pk=None):
        item = self.get_object()
        item.is_favorite = not item.is_favorite
        item.save(update_fields=["is_favorite", "updated_at"])
        return Response(GarmentItemSerializer(item, context={"request": request}).data)

    @extend_schema(summary="Move many items into one location at once", request=BulkLocationSerializer)
    @action(detail=False, methods=["post"], url_path="bulk-move")
    def bulk_move(self, request):
        payload = BulkLocationSerializer(data=request.data)
        payload.is_valid(raise_exception=True)

        location = payload.validated_data["storage_location"]
        if location and location.owner_id != request.user.id:
            raise ValidationError({"storage_location": "That location does not belong to you."})

        with transaction.atomic():
            updated = GarmentItem.objects.filter(
                owner=request.user, id__in=payload.validated_data["item_ids"]
            ).update(storage_location=location)

        return Response({"updated": updated, "storage_location": location.id if location else None})

    @extend_schema(summary="Counts for the dashboard cards")
    @action(detail=False, methods=["get"])
    def stats(self, request):
        """
        One query for the whole dashboard instead of six separate endpoints.

        `filter=` inside Count/Sum is a conditional aggregate: PostgreSQL
        computes all of these in a single pass over the table.
        """
        qs = GarmentItem.objects.filter(owner=request.user)

        totals = qs.aggregate(
            total=Count("id"),
            in_wardrobe=Count("id", filter=Q(status=GarmentItem.Status.IN_WARDROBE)),
            in_laundry=Count("id", filter=Q(status=GarmentItem.Status.IN_LAUNDRY)),
            favorites=Count("id", filter=Q(is_favorite=True)),
            unplaced=Count("id", filter=Q(storage_location__isnull=True)),
            never_worn=Count("id", filter=Q(wear_count=0)),
            total_spent=Sum("purchase_price"),
            total_wears=Sum("wear_count"),
        )

        by_slot = list(
            qs.values("category__slot")
            .annotate(count=Count("id"))
            .order_by("-count")
        )

        return Response(
            {
                **totals,
                "total_spent": float(totals["total_spent"] or 0),
                "total_wears": totals["total_wears"] or 0,
                "storage_locations": StorageLocation.objects.filter(owner=request.user).count(),
                "by_slot": [
                    {"slot": row["category__slot"], "count": row["count"]} for row in by_slot
                ],
            }
        )


# ===========================================================================
#  IMAGE UPLOAD + BACKGROUND REMOVAL
# ===========================================================================

@extend_schema(
    tags=["Wardrobe"],
    summary="Upload a garment photo, remove its background, detect its colour",
    description=(
        "Send one image as multipart/form-data under the key `image`.\n\n"
        "The server removes the background with rembg, trims the empty space, "
        "detects the dominant colour, and uploads BOTH the original and the "
        "cutout to Cloudinary.\n\n"
        "Nothing is saved to the database yet - the response is what you then "
        "pass to POST /api/wardrobe/items/ to create the item."
    ),
    request={"multipart/form-data": ImageUploadRequestSerializer},
    responses={201: ImageUploadResponseSerializer},
)
class GarmentImageUploadView(APIView):
    """
    Deliberately separate from item creation.

    Why: background removal takes a few seconds. Splitting it out lets the Add
    Item page show the cutout preview while the user is still typing the brand
    and price, instead of making them wait after pressing Save.
    """

    parser_classes = [MultiPartParser, FormParser]
    serializer_class = ImageUploadRequestSerializer

    def post(self, request):
        upload = request.FILES.get("image")
        if not upload:
            raise ValidationError({"image": "No file was sent under the key 'image'."})

        if upload.size > MAX_UPLOAD_BYTES:
            raise ValidationError(
                {"image": f"That image is {upload.size // 1024 // 1024} MB. The limit is 12 MB."}
            )

        content_type = (upload.content_type or "").lower()
        if content_type not in ALLOWED_IMAGE_TYPES:
            raise ValidationError(
                {"image": f"'{content_type}' is not a supported image type. Use JPG, PNG or WebP."}
            )

        raw = upload.read()

        # ---- 1. remove the background -------------------------------------
        try:
            cutout = remove_background(raw)
        except ValueError as exc:
            raise ValidationError({"image": str(exc)}) from exc
        except Exception as exc:  # model failure, out of memory, corrupt file
            logger.exception("Background removal failed")
            raise ValidationError(
                {"image": "The background could not be removed from that image. Try another photo."}
            ) from exc

        # ---- 2. store both versions ---------------------------------------
        user_id = request.user.id
        try:
            original = storage.upload_image(
                raw, storage.Folder.GARMENT_ORIGINAL, user_id=user_id, tags=["garment", "original"]
            )
            clean = storage.upload_image(
                cutout.png_bytes,
                storage.Folder.GARMENT_CLEAN,
                user_id=user_id,
                tags=["garment", "clean"],
            )
        except storage.CloudinaryNotConfigured as exc:
            raise ValidationError({"image": str(exc)}) from exc

        # ---- 3. describe what we found ------------------------------------
        color_name = name_for_hex(cutout.dominant_hex)

        return Response(
            {
                "original_image_url": original.url,
                "original_image_public_id": original.public_id,
                "clean_image_url": clean.url,
                "clean_image_public_id": clean.public_id,
                "detected": {
                    "primary_color_hex": cutout.dominant_hex,
                    "primary_color_name": color_name,
                    "width": cutout.width,
                    "height": cutout.height,
                },
                "processing_ms": cutout.duration_ms,
                "coverage": cutout.coverage,
                "warning": (
                    "Hardly anything was detected in that photo. Try better lighting, "
                    "or a background that contrasts with the garment."
                    if cutout.looks_empty
                    else None
                ),
            },
            status=status.HTTP_201_CREATED,
        )
