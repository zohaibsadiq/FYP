from __future__ import annotations

from rest_framework import serializers

from apps.vision.uploads import ALLOWED_IMAGE_TYPES, MAX_UPLOAD_BYTES
from apps.wardrobe.models import Category, GarmentItem

from . import providers
from .models import TryOn

# What a person is asked when the app cannot work it out itself. The labels
# name body parts, not the supplier's field names.
SLOT_CHOICES = [
    ("TOP", "Top half"),
    ("BOTTOM", "Bottom half"),
    ("FULL_BODY", "Full outfit"),
]


class TryOnSerializer(serializers.ModelSerializer):
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    garment_slot_label = serializers.SerializerMethodField()

    class Meta:
        model = TryOn
        fields = [
            "id", "item", "garment_name", "garment_image_url",
            "garment_slot", "garment_slot_label",
            "status", "status_label", "result_url", "error",
            "created_at", "completed_at",
        ]
        read_only_fields = fields

    def get_garment_slot_label(self, attempt: TryOn) -> str:
        return dict(SLOT_CHOICES).get(attempt.garment_slot, attempt.garment_slot)


class CreateFromClosetSerializer(serializers.Serializer):
    """The garment is already in the closet, so where it is worn is read from its category rather than asked."""

    item = serializers.PrimaryKeyRelatedField(queryset=GarmentItem.objects.none())

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            self.fields["item"].queryset = GarmentItem.objects.filter(
                owner=request.user
            ).exclude(status__in=GarmentItem.AWAY_STATUSES)

    def validate_item(self, item: GarmentItem) -> GarmentItem:
        if not item.display_image_url:
            raise serializers.ValidationError(f"{item.name} has no picture to draw on.")
        if not providers.supports(item.category.slot):
            raise serializers.ValidationError(
                "Only tops, bottoms, outerwear and full outfits can be drawn on."
            )
        return item


class CreateFromUploadSerializer(serializers.Serializer):
    """
    A photo that is not in the closet. Nothing is known about it, so the person
    has to say which part of the body it covers. Sent as the wrong one, a kurta
    gets drawn onto the legs.
    """

    image = serializers.ImageField(write_only=True)
    garment_slot = serializers.ChoiceField(choices=SLOT_CHOICES)
    # Empty means try it and forget it. A name means keep it in the closet.
    save_as = serializers.CharField(max_length=120, required=False, allow_blank=True)

    def validate_image(self, upload):
        if upload.size > MAX_UPLOAD_BYTES:
            megabytes = upload.size / 1024 / 1024
            raise serializers.ValidationError(
                f"That image is {megabytes:.0f} MB. The limit is 12 MB."
            )
        content_type = (getattr(upload, "content_type", "") or "").lower()
        if content_type not in ALLOWED_IMAGE_TYPES:
            raise serializers.ValidationError(
                f"'{content_type}' is not a supported image type. Use JPG, PNG or WebP."
            )
        return upload

    def validate_save_as(self, value: str) -> str:
        return value.strip()

    def validate(self, attrs):
        if attrs.get("save_as") and not self._category_for(attrs["garment_slot"]):
            raise serializers.ValidationError(
                {"save_as": "There is nowhere in the closet to file that kind of thing."}
            )
        return attrs

    @staticmethod
    def _category_for(slot: str) -> Category | None:
        """The kind a kept upload is filed under, picked from the built-in set."""
        return (
            Category.objects.filter(owner__isnull=True, slot=slot)
            .order_by("sort_order", "name")
            .first()
        )


class BodyPhotoSerializer(serializers.Serializer):
    """
    Consent is sent with the photo rather than remembered in the browser,
    because the permission has to be provable on the server that acts on it.
    """

    consent = serializers.BooleanField()

    def validate_consent(self, value: bool) -> bool:
        if not value:
            raise serializers.ValidationError(
                "Tick the box to say the photo may be sent away to be processed."
            )
        return value


class BodyPhotoStateSerializer(serializers.Serializer):
    """What the page needs to decide between showing an upload box and showing the saved photo."""

    has_body_photo = serializers.BooleanField()
    body_photo_url = serializers.CharField(allow_blank=True)
    consented_at = serializers.DateTimeField(allow_null=True)


class TryOnStatusSerializer(serializers.Serializer):
    available = serializers.BooleanField()
    has_body_photo = serializers.BooleanField()
    daily_limit = serializers.IntegerField()
    used_today = serializers.IntegerField()
    left_today = serializers.IntegerField()
