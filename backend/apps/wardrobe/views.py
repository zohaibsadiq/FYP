from __future__ import annotations

import logging

from django.db import IntegrityError, transaction
from django.db.models import Count, Prefetch, Q, Sum
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.filters import OrderingFilter
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.intelligence.colors import name_for_hex
from apps.vision import storage
from apps.vision.uploads import read_upload
from apps.vision.background import remove_background

from .filters import GarmentItemFilter, SpellingTolerantSearch, WearEventFilter
from .models import Category, GarmentItem, StorageLocation, WearEvent

# Sold and put-away things stay in the database for their history, but they
# are not part of "what I have", so every count of a wardrobe leaves them out.
STILL_OWNED = ~Q(status__in=GarmentItem.GONE_STATUSES)


def still_owned_items() -> object:
    """The items a count should see: everything except sold and put away."""
    return GarmentItem.objects.exclude(status__in=GarmentItem.GONE_STATUSES)
from .serializers import (
    BulkLocationSerializer,
    CategorySerializer,
    GarmentItemListSerializer,
    GarmentItemSerializer,
    ImageDiscardSerializer,
    ImageUploadRequestSerializer,
    ImageUploadResponseSerializer,
    MarkWornSerializer,
    StorageLocationSerializer,
    StorageLocationTreeSerializer,
    WearEventSerializer,
)

logger = logging.getLogger(__name__)


DUPLICATE_NAME = "You have just added something with that name. Please use a different one."


def _save_unique(serializer, clash=None, **kwargs):
    """
    The serializers check for a clash first, which is what produces a readable
    message. Two requests arriving together both pass that check and one then
    hits the database constraint, so the same answer is given again rather than
    a 500.
    """
    try:
        with transaction.atomic():
            return serializer.save(**kwargs)
    except IntegrityError as exc:
        raise ValidationError(clash or {"name": DUPLICATE_NAME}) from exc




@extend_schema(tags=["Wardrobe"])
class CategoryViewSet(viewsets.ModelViewSet):
    """Built-in categories, which are read-only, plus any the account has added."""

    serializer_class = CategorySerializer
    # Placeholder so drf-spectacular can resolve the model; get_queryset() is
    # what serves requests.
    queryset = Category.objects.none()

    def get_queryset(self):
        return (
            Category.objects.filter(Q(owner__isnull=True) | Q(owner=self.request.user))
            .annotate(
                item_count=Count(
                    "items",
                    filter=Q(items__owner=self.request.user)
                    & ~Q(items__status__in=GarmentItem.GONE_STATUSES),
                )
            )
            .order_by("sort_order", "name")
        )

    def perform_create(self, serializer):
        _save_unique(serializer, owner=self.request.user)

    def _guard_system_category(self, instance: Category):
        if instance.is_system:
            raise ValidationError("Built-in categories cannot be changed or deleted.")

    def perform_update(self, serializer):
        self._guard_system_category(serializer.instance)
        _save_unique(serializer)

    def perform_destroy(self, instance):
        self._guard_system_category(instance)
        if instance.items.exists():
            raise ValidationError(
                "This category still has items in it. Move them first, then delete it."
            )
        instance.delete()


@extend_schema(tags=["Wardrobe"])
class StorageLocationViewSet(viewsets.ModelViewSet):
    """Places where garments are kept, nestable to four levels."""

    serializer_class = StorageLocationSerializer
    queryset = StorageLocation.objects.none()

    def get_queryset(self):
        return (
            StorageLocation.objects.filter(owner=self.request.user)
            .select_related("parent")
            .annotate(
                item_count=Count(
                    "items", filter=~Q(items__status__in=GarmentItem.GONE_STATUSES)
                )
            )
        )

    def perform_create(self, serializer):
        _save_unique(serializer, owner=self.request.user)

    def perform_update(self, serializer):
        _save_unique(serializer)

    def perform_destroy(self, instance: StorageLocation):
        """Child locations cascade; their items survive with storage_location NULL."""
        instance.delete()

    @extend_schema(
        summary="Whole storage hierarchy, nested",
        responses=StorageLocationTreeSerializer(many=True),
    )
    @action(detail=False, methods=["get"])
    def tree(self, request):
        roots = (
            StorageLocation.objects.filter(owner=request.user, parent__isnull=True)
            .prefetch_related(
                "children__children__children",
                Prefetch("items", queryset=still_owned_items()),
                Prefetch("children__items", queryset=still_owned_items()),
                Prefetch("children__children__items", queryset=still_owned_items()),
                Prefetch(
                    "children__children__children__items",
                    queryset=still_owned_items(),
                ),
            )
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
            .exclude(status__in=GarmentItem.GONE_STATUSES)
            .with_last_occasion()
            .select_related("category", "storage_location")
            .order_by("name")
        )
        return Response(
            GarmentItemListSerializer(qs, many=True, context={"request": request}).data
        )


@extend_schema_view(
    list=extend_schema(
        summary="The closet, filtered and searched",
        description=(
            "Search tolerates misspellings: when nothing matches the words "
            "typed, the nearest spellings are returned and `spelling_guessed` "
            "is set on the page."
        ),
    ),
    create=extend_schema(summary="Add one garment to the closet"),
    retrieve=extend_schema(summary="One garment, with every field"),
    update=extend_schema(summary="Replace every field of one garment"),
    partial_update=extend_schema(summary="Change some fields of one garment"),
    destroy=extend_schema(
        summary="Remove a garment, and its photos with it",
        description="The Cloudinary uploads it points at are deleted too.",
    ),
)
@extend_schema(tags=["Wardrobe"])
class GarmentItemViewSet(viewsets.ModelViewSet):
    queryset = GarmentItem.objects.none()
    filterset_class = GarmentItemFilter
    filter_backends = [DjangoFilterBackend, SpellingTolerantSearch, OrderingFilter]
    search_fields = ["name", "brand", "notes", "category__name", "primary_color_name"]
    ordering_fields = ["created_at", "name", "wear_count", "last_worn_date", "purchase_price"]
    ordering = ["-created_at"]

    def get_queryset(self):
        # Owner filtering here is the only thing stopping cross-account reads:
        # detail routes resolve against this queryset, so a guessed id gives a 404.
        mine = (
            GarmentItem.objects.filter(owner=self.request.user)
            .with_last_occasion()
            .select_related("category", "storage_location", "storage_location__parent")
        )

        # Something sold or archived is not in the wardrobe any more, so the
        # list of clothes leaves it out. Asking for it by status still finds
        # it, and so does opening it directly, because the row is still there
        # and its history still means something.
        params = self.request.query_params
        asked_by_status = params.get("status") in GarmentItem.GONE_STATUSES
        asked_for_gone = params.get("gone") in ("true", "True", "1")
        if self.action == "list" and not (asked_by_status or asked_for_gone):
            mine = mine.exclude(status__in=GarmentItem.GONE_STATUSES)
        return mine

    def get_serializer_class(self):
        if self.action == "list":
            return GarmentItemListSerializer
        return GarmentItemSerializer

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

    def perform_destroy(self, instance: GarmentItem):
        """Cloudinary keeps uploads until they are deleted by public_id."""
        for public_id in (instance.clean_image_public_id, instance.original_image_public_id):
            if public_id:
                storage.delete_image(public_id)
        instance.delete()

    @extend_schema(summary="Log that this item was worn", request=MarkWornSerializer)
    @action(detail=True, methods=["post"], url_path="mark-worn")
    def mark_worn(self, request, pk=None):
        item = self.get_object()
        if item.status in GarmentItem.AWAY_STATUSES:
            raise ValidationError(
                f"{item.name} is {item.get_status_display().lower()}, so wearing it "
                "cannot be recorded."
            )
        payload = MarkWornSerializer(data=request.data)
        payload.is_valid(raise_exception=True)

        item.mark_worn(
            payload.validated_data.get("date"),
            payload.validated_data.get("note", ""),
        )
        # Read back through the annotated queryset: the last occasion is worked
        # out in the query, so the copy in memory still holds the one before.
        return Response(
            GarmentItemSerializer(
                self.get_queryset().get(pk=item.pk), context={"request": request}
            ).data
        )

    @extend_schema(
        summary="Undo a wearing, for a mistaken tap",
        request=MarkWornSerializer,
    )
    @action(detail=True, methods=["post"], url_path="unmark-worn")
    def unmark_worn(self, request, pk=None):
        item = self.get_object()
        payload = MarkWornSerializer(data=request.data)
        payload.is_valid(raise_exception=True)

        day = payload.validated_data.get("date") or timezone.localdate()
        if not item.forget_wear(day):
            raise ValidationError(f"{item.name} is not recorded as worn on {day}.")
        return Response(
            GarmentItemSerializer(
                self.get_queryset().get(pk=item.pk), context={"request": request}
            ).data
        )

    @extend_schema(
        summary="Every day this item was worn, newest first",
        responses=WearEventSerializer(many=True),
    )
    @action(detail=True, methods=["get"])
    def wears(self, request, pk=None):
        item = self.get_object()
        log = item.wears.select_related("item", "item__category").order_by("-worn_on")
        return Response(
            WearEventSerializer(log, many=True, context={"request": request}).data
        )

    @extend_schema(summary="Move between 'In wardrobe' and 'In the wash'")
    @action(detail=True, methods=["post"], url_path="toggle-laundry")
    def toggle_laundry(self, request, pk=None):
        item = self.get_object()

        if item.status == GarmentItem.Status.IN_LAUNDRY:
            item.status = GarmentItem.Status.IN_WARDROBE
        elif item.status == GarmentItem.Status.IN_WARDROBE:
            item.status = GarmentItem.Status.IN_LAUNDRY
        else:
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
            raise ValidationError({"storage_location": "That location belongs to another account."})

        with transaction.atomic():
            # update() skips save(), and with it the auto_now on updated_at.
            updated = GarmentItem.objects.filter(
                owner=request.user, id__in=payload.validated_data["item_ids"]
            ).update(storage_location=location, updated_at=timezone.now())

        return Response({"updated": updated, "storage_location": location.id if location else None})

    @extend_schema(summary="Counts for the dashboard cards")
    @action(detail=False, methods=["get"])
    def stats(self, request):
        qs = GarmentItem.objects.filter(owner=request.user)

        # "total" is what somebody still owns. Counting things they have sold
        # would tell them they have more clothes than they do.
        kept = STILL_OWNED
        totals = qs.aggregate(
            total=Count("id", filter=kept),
            in_wardrobe=Count("id", filter=Q(status=GarmentItem.Status.IN_WARDROBE)),
            in_laundry=Count("id", filter=Q(status=GarmentItem.Status.IN_LAUNDRY)),
            favorites=Count("id", filter=Q(is_favorite=True) & kept),
            unplaced=Count("id", filter=Q(storage_location__isnull=True) & kept),
            never_worn=Count("id", filter=Q(wear_count=0) & kept),
            # What the closet page needs to decide whether the "sold and put
            # away" button is worth showing at all.
            gone=Count("id", filter=Q(status__in=GarmentItem.GONE_STATUSES)),
            total_spent=Sum("purchase_price", filter=STILL_OWNED),
            total_wears=Sum("wear_count"),
        )

        # Counted the same way as "total", so the slot breakdown adds up to it
        # instead of quietly exceeding it once somebody has sold something.
        by_slot = list(
            qs.exclude(status__in=GarmentItem.GONE_STATUSES)
            .values("category__slot")
            .annotate(count=Count("id"))
            .order_by("-count")
        )

        # Two numbers the dashboard leads with: what is actually getting used,
        # and what has been sitting untouched long enough to be worth a nudge.
        week_ago = timezone.localdate() - timezone.timedelta(days=6)
        stale = timezone.localdate() - timezone.timedelta(days=90)
        worn_this_week = (
            WearEvent.objects.filter(owner=request.user, worn_on__gte=week_ago)
            .values("item_id")
            .distinct()
            .count()
        )
        forgotten = qs.filter(
            (Q(last_worn_date__lt=stale) | Q(last_worn_date__isnull=True)) & STILL_OWNED
        ).count()

        return Response(
            {
                **totals,
                "total_spent": float(totals["total_spent"] or 0),
                "total_wears": totals["total_wears"] or 0,
                "worn_this_week": worn_this_week,
                "not_worn_in_90_days": forgotten,
                "storage_locations": StorageLocation.objects.filter(owner=request.user).count(),
                "by_slot": [
                    {"slot": row["category__slot"], "count": row["count"]} for row in by_slot
                ],
            }
        )


@extend_schema(
    tags=["Wardrobe"],
    summary="Upload a garment photo, remove its background, detect its colour",
    description=(
        "Send one image as multipart/form-data under the key `image`.\n\n"
        "The server removes the background, trims the empty space, detects the "
        "dominant colour, and uploads BOTH the original and the cutout to "
        "Cloudinary.\n\n"
        "Nothing is written to the database here. The response fields are the "
        "body of the follow-up POST /api/wardrobe/items/ that creates the item."
    ),
    request={"multipart/form-data": ImageUploadRequestSerializer},
    responses={201: ImageUploadResponseSerializer},
)
class GarmentImageUploadView(APIView):
    """
    Kept separate from item creation because background removal takes a few
    seconds: the cutout preview appears while the rest of the form is still being
    filled in.
    """

    parser_classes = [MultiPartParser, FormParser]
    serializer_class = ImageUploadRequestSerializer

    def post(self, request):
        raw = read_upload(request)

        try:
            cutout = remove_background(raw)
        except ValueError as exc:
            raise ValidationError({"image": str(exc)}) from exc
        except Exception as exc:  # model failure, out of memory, corrupt file
            logger.exception("Background removal failed")
            raise ValidationError(
                {"image": "The background could not be removed from that image. Try another photo."}
            ) from exc

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


class GarmentImageDiscardView(APIView):
    """
    Throws away an upload that never became an item. The upload endpoint writes
    to Cloudinary before the form is submitted, so swapping a photo or leaving
    the page would otherwise keep paying to store it.
    """

    serializer_class = ImageDiscardSerializer

    FOLDERS = (storage.Folder.GARMENT_ORIGINAL, storage.Folder.GARMENT_CLEAN)

    @extend_schema(summary="Delete an upload that was never attached to an item")
    def post(self, request):
        payload = ImageDiscardSerializer(data=request.data)
        payload.is_valid(raise_exception=True)

        removed, kept = [], []
        for public_id in payload.validated_data["public_ids"]:
            if not any(
                storage.owns_public_id(public_id, folder, request.user.id)
                for folder in self.FOLDERS
            ):
                raise ValidationError(
                    {"public_ids": "That image was uploaded by another account."}
                )

            # An id an item still points at is not an orphan, whatever the client
            # believes: deleting it would leave that item with a broken photo.
            if GarmentItem.objects.filter(
                Q(original_image_public_id=public_id) | Q(clean_image_public_id=public_id)
            ).exists():
                kept.append(public_id)
                continue

            if storage.delete_image(public_id):
                removed.append(public_id)

        return Response({"removed": removed, "kept": kept}, status=status.HTTP_200_OK)


ALREADY_WORN = {"worn_on": "That item is already recorded as worn on that day."}


@extend_schema(tags=["Wardrobe"])
class WearEventViewSet(viewsets.ModelViewSet):
    """
    The record of what was worn and when. The closet screen only needs the
    running total on each item, so this is for the history list, the calendar
    and the "what did I wear that day" lookup.
    """

    queryset = WearEvent.objects.none()
    serializer_class = WearEventSerializer
    filterset_class = WearEventFilter
    ordering_fields = ["worn_on", "created_at"]
    ordering = ["-worn_on", "-created_at"]

    def get_queryset(self):
        return (
            WearEvent.objects.filter(owner=self.request.user)
            .select_related("item", "item__category")
        )

    def perform_create(self, serializer):
        event = _save_unique(serializer, clash=ALREADY_WORN, owner=self.request.user)
        event.item.resync_wear_totals()

    def perform_update(self, serializer):
        before = serializer.instance.item_id
        event = _save_unique(serializer, clash=ALREADY_WORN)
        event.item.resync_wear_totals()
        if before != event.item_id:
            GarmentItem.objects.get(pk=before).resync_wear_totals()

    def perform_destroy(self, instance: WearEvent):
        item = instance.item
        instance.delete()
        item.resync_wear_totals()

    @extend_schema(summary="How many things were worn on each day of a range")
    @action(detail=False, methods=["get"])
    def calendar(self, request):
        """
        One row per day, for drawing a month grid without sending every wearing
        in it. The screen asks for the detail of a day only when it is opened.
        """
        days = (
            self.filter_queryset(self.get_queryset())
            .values("worn_on")
            .annotate(count=Count("id"))
            .order_by("worn_on")
        )
        return Response([{"date": row["worn_on"], "count": row["count"]} for row in days])
