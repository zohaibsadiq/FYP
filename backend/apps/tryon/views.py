from __future__ import annotations

import logging

from django.conf import settings
from django.db import transaction
from django.utils import timezone
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import mixins, status, viewsets
from rest_framework.exceptions import ValidationError
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.vision import storage
from apps.vision.uploads import read_upload
from apps.wardrobe.models import GarmentItem

from . import providers
from .models import TryOn
from .serializers import (
    BodyPhotoSerializer,
    BodyPhotoStateSerializer,
    CreateFromClosetSerializer,
    CreateFromUploadSerializer,
    TryOnSerializer,
    TryOnStatusSerializer,
)

logger = logging.getLogger(__name__)


def refresh(attempt: TryOn) -> TryOn:
    """
    Asks the supplier how far a queued picture has got. A finished picture is
    copied onto this project's own image host, because the supplier's link
    expires after a while and the person's picture should not.
    """
    try:
        progress = providers.check(attempt.provider_task_id)
    except providers.TryOnUnavailable:
        # Still waiting. The supplier being briefly unreachable is not a
        # failure of the picture, and the next check will ask again.
        return attempt
    except Exception:
        logger.exception("Could not read try-on task %s", attempt.provider_task_id)
        return attempt

    if not progress.done:
        return attempt

    if progress.error:
        attempt.failed(progress.error)
        return attempt

    try:
        saved = storage.upload_image(
            progress.image_url, storage.Folder.TRY_ON_RESULT, user_id=attempt.owner_id
        )
    except Exception:
        logger.exception("Could not store try-on result for %s", attempt.pk)
        attempt.failed("The picture was made but could not be saved. Try again.")
        return attempt

    attempt.succeeded(saved.url, saved.public_id, attempt.provider)
    return attempt


@extend_schema(tags=["Try-On"])
class BodyPhotoView(APIView):
    """The photograph every generated image is drawn onto."""

    parser_classes = [MultiPartParser, FormParser]
    throttle_scope = "body-photo"

    @extend_schema(summary="Whether a body photo is saved",
                   responses={200: BodyPhotoStateSerializer})
    def get(self, request):
        return Response({
            "has_body_photo": bool(request.user.body_photo_url),
            "body_photo_url": request.user.body_photo_url,
            "consented_at": request.user.body_photo_consent_at,
        })

    @extend_schema(
        summary="Save or replace the body photo",
        request=BodyPhotoSerializer,
        responses={201: BodyPhotoStateSerializer},
    )
    def post(self, request):
        form = BodyPhotoSerializer(data=request.data)
        form.is_valid(raise_exception=True)

        image = read_upload(request, field="image")

        if not storage.is_configured():
            raise ValidationError(
                {"image": "Photo storage is not set up, so the picture cannot be saved."}
            )

        # A fixed file name means one photo per account. A new upload replaces
        # the old one instead of leaving a growing pile of old photos behind.
        saved = storage.upload_image(
            image,
            storage.Folder.BODY_PHOTO,
            user_id=request.user.id,
            public_id="body",
            overwrite=True,
        )

        request.user.body_photo_url = saved.url
        request.user.body_photo_public_id = saved.public_id
        request.user.body_photo_consent_at = timezone.now()
        request.user.save(
            update_fields=["body_photo_url", "body_photo_public_id", "body_photo_consent_at"]
        )

        return Response(
            {"has_body_photo": True, "body_photo_url": saved.url},
            status=status.HTTP_201_CREATED,
        )

    @extend_schema(summary="Delete the body photo and everything made from it",
                   request=None, responses={204: None})
    def delete(self, request):
        user = request.user
        results = list(TryOn.objects.filter(owner=user))

        with transaction.atomic():
            TryOn.objects.filter(owner=user).delete()
            old_id = user.body_photo_public_id
            user.body_photo_url = ""
            user.body_photo_public_id = ""
            user.body_photo_consent_at = None
            user.save(
                update_fields=["body_photo_url", "body_photo_public_id", "body_photo_consent_at"]
            )

        # The files are deleted after the rows are gone. If deleting a file
        # fails, a leftover file remains, which prune_images collects later.
        # The other way round would leave rows pointing at pictures that no
        # longer exist, which is worse.
        storage.delete_image(old_id)
        for row in results:
            storage.delete_image(row.result_public_id)

        return Response(status=status.HTTP_204_NO_CONTENT)


@extend_schema_view(
    list=extend_schema(tags=["Try-On"], summary="Pictures made for this account"),
    retrieve=extend_schema(tags=["Try-On"], summary="One picture"),
    destroy=extend_schema(tags=["Try-On"], summary="Delete one picture"),
)
class TryOnViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = TryOnSerializer
    queryset = TryOn.objects.none()
    throttle_scope = None
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def get_queryset(self):
        return TryOn.objects.filter(owner=self.request.user).select_related(
            "item", "item__category"
        )

    def list(self, request, *args, **kwargs):
        for attempt in self.get_queryset().filter(status=TryOn.Status.PENDING):
            if attempt.is_waiting:
                refresh(attempt)
        return super().list(request, *args, **kwargs)

    def retrieve(self, request, *args, **kwargs):
        # The supplier is only asked while a picture is still waiting, so
        # opening a finished one costs nothing.
        attempt = self.get_object()
        if attempt.is_waiting:
            refresh(attempt)
        return Response(TryOnSerializer(attempt).data)

    def perform_destroy(self, instance: TryOn):
        # A garment kept in the closet owns its own picture file. One that was
        # only uploaded to be tried on has nothing else pointing at it, so it
        # goes with the result.
        orphans = [instance.result_public_id, instance.garment_public_id]
        instance.delete()
        for public_id in orphans:
            storage.delete_image(public_id)

    @extend_schema(
        tags=["Try-On"],
        summary="Draw a garment onto my body photo",
        description=(
            "Send `item` to use something already in the closet, where the part "
            "of the body it covers is already known.\n\n"
            "Send `image` and `garment_slot` to use a photograph that is not in "
            "the closet. Add `save_as` to keep it as a new garment."
        ),
        request={
            "application/json": CreateFromClosetSerializer,
            "multipart/form-data": CreateFromUploadSerializer,
        },
        responses={201: TryOnSerializer, 400: TryOnSerializer, 503: TryOnSerializer},
    )
    def create(self, request):
        user = request.user

        if not user.body_photo_url:
            raise ValidationError({"body_photo": "Add a photo of yourself first."})

        self._refuse_if_out_of_turns(user)

        if "image" in request.FILES:
            garment = self._garment_from_upload(request)
        else:
            garment = self._garment_from_closet(request)

        attempt = TryOn.objects.create(
            owner=user,
            item=garment.get("item"),
            garment_name=garment["name"],
            garment_image_url=garment["image_url"],
            garment_slot=garment["slot"],
            garment_public_id=garment.get("public_id", ""),
            body_photo_url=user.body_photo_url,
        )

        try:
            queued = providers.submit(
                body_photo_url=user.body_photo_url,
                garment_image_url=attempt.garment_image_url,
                slot=attempt.garment_slot,
            )
        except providers.TryOnRefused as exc:
            attempt.failed(str(exc))
            return Response(TryOnSerializer(attempt).data, status=status.HTTP_400_BAD_REQUEST)
        except providers.TryOnUnavailable as exc:
            attempt.failed(str(exc))
            return Response(
                TryOnSerializer(attempt).data, status=status.HTTP_503_SERVICE_UNAVAILABLE
            )
        except Exception:
            logger.exception("Try-on submit failed for user %s", user.pk)
            attempt.failed("That did not work. Try again in a little while.")
            return Response(
                TryOnSerializer(attempt).data, status=status.HTTP_503_SERVICE_UNAVAILABLE
            )

        attempt.queued(queued.task_id, queued.provider)
        return Response(TryOnSerializer(attempt).data, status=status.HTTP_201_CREATED)

    def _refuse_if_out_of_turns(self, user) -> None:
        """
        Every generated picture costs money. The rate limit slows a burst down;
        this daily count is what stops a determined person spending the budget.
        """
        if TryOn.objects.made_today(user).count() >= settings.TRYON_DAILY_LIMIT:
            raise ValidationError({
                "limit": (
                    f"That is {settings.TRYON_DAILY_LIMIT} pictures today, which is "
                    "the most anybody gets. Come back tomorrow."
                )
            })

    def _garment_from_closet(self, request) -> dict:
        form = CreateFromClosetSerializer(data=request.data, context={"request": request})
        form.is_valid(raise_exception=True)
        item = form.validated_data["item"]
        return {
            "item": item,
            "name": item.name,
            "image_url": item.display_image_url,
            "slot": item.category.slot,
        }

    def _garment_from_upload(self, request) -> dict:
        form = CreateFromUploadSerializer(data=request.data)
        form.is_valid(raise_exception=True)
        upload = form.validated_data["image"]
        slot = form.validated_data["garment_slot"]
        keep_as = form.validated_data.get("save_as", "")

        if not storage.is_configured():
            raise ValidationError(
                {"image": "Photo storage is not set up, so the picture cannot be used."}
            )

        saved = storage.upload_image(
            upload.read(), storage.Folder.GARMENT_ORIGINAL, user_id=request.user.id
        )

        item = None
        if keep_as:
            item = GarmentItem.objects.create(
                owner=request.user,
                name=keep_as,
                category=CreateFromUploadSerializer._category_for(slot),
                original_image_url=saved.url,
                original_image_public_id=saved.public_id,
            )

        return {
            "item": item,
            "name": keep_as or "Uploaded photo",
            "image_url": saved.url,
            "slot": slot,
            # Only remembered when nothing in the closet owns the file, so
            # deleting the picture is what cleans it up.
            "public_id": "" if item else saved.public_id,
        }


@extend_schema(
    tags=["Try-On"],
    summary="Whether Try-On can run, and what is left today",
    responses={200: TryOnStatusSerializer},
)
class TryOnStatusView(APIView):
    """Lets the page explain itself instead of offering a button that would fail."""

    def get(self, request):
        used = TryOn.objects.made_today(request.user).count()
        return Response({
            "available": providers.is_configured(),
            "has_body_photo": bool(request.user.body_photo_url),
            "daily_limit": settings.TRYON_DAILY_LIMIT,
            "used_today": used,
            "left_today": max(0, settings.TRYON_DAILY_LIMIT - used),
        })
