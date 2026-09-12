"""
`owner` is never accepted from the request body. Every view sets it from
request.user.
"""

from __future__ import annotations

from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from .models import Category, GarmentItem, StorageLocation


class CategorySerializer(serializers.ModelSerializer):
    slot_label = serializers.CharField(source="get_slot_display", read_only=True)
    is_system = serializers.BooleanField(read_only=True)
    item_count = serializers.IntegerField(read_only=True)  # annotated in the view

    class Meta:
        model = Category
        fields = ["id", "name", "slot", "slot_label", "icon", "sort_order", "is_system", "item_count"]
        read_only_fields = ["id", "is_system", "item_count"]


class StorageLocationSerializer(serializers.ModelSerializer):
    full_path = serializers.CharField(read_only=True)
    depth = serializers.IntegerField(read_only=True)
    kind_label = serializers.CharField(source="get_kind_display", read_only=True)
    item_count = serializers.IntegerField(read_only=True)  # annotated in the view

    class Meta:
        model = StorageLocation
        fields = [
            "id", "name", "kind", "kind_label", "parent",
            "full_path", "depth", "notes", "item_count", "created_at",
        ]
        read_only_fields = ["id", "full_path", "depth", "item_count", "created_at"]

    def validate_parent(self, value: StorageLocation | None):
        if value is None:
            return value
        request = self.context.get("request")
        if request and value.owner_id != request.user.id:
            raise serializers.ValidationError("That parent location belongs to another account.")
        return value

    def validate(self, attrs):
        """Run the model clean() so the cycle and depth rules apply to API writes."""
        instance = StorageLocation(**{**self._current_values(), **attrs})
        instance.pk = self.instance.pk if self.instance else None
        instance.owner = self.context["request"].user
        instance.clean()
        return attrs

    def _current_values(self) -> dict:
        """Existing field values, so a PATCH of one field still validates the whole object."""
        if not self.instance:
            return {}
        return {
            "name": self.instance.name,
            "kind": self.instance.kind,
            "parent": self.instance.parent,
            "notes": self.instance.notes,
        }


class StorageLocationTreeSerializer(serializers.ModelSerializer):
    """Nested representation used by the storage page to draw the hierarchy."""

    children = serializers.SerializerMethodField()
    kind_label = serializers.CharField(source="get_kind_display", read_only=True)
    item_count = serializers.SerializerMethodField()

    class Meta:
        model = StorageLocation
        fields = ["id", "name", "kind", "kind_label", "notes", "item_count", "children"]

    @extend_schema_field(serializers.ListField(child=serializers.DictField()))
    def get_children(self, obj: StorageLocation):
        # children is prefetched three levels deep in the view, so recursing here
        # costs no extra queries.
        return StorageLocationTreeSerializer(
            obj.children.all(), many=True, context=self.context
        ).data

    def get_item_count(self, obj: StorageLocation) -> int:
        """Items directly in this location, not counting sub-locations."""
        return obj.items.count()


class GarmentItemListSerializer(serializers.ModelSerializer):
    """Fewer fields than the detail serializer; the closet grid loads 24 at a time."""

    category_name = serializers.CharField(source="category.name", read_only=True)
    category_slot = serializers.CharField(source="category.slot", read_only=True)
    display_image_url = serializers.CharField(read_only=True)
    location_path = serializers.CharField(read_only=True)
    cost_per_wear = serializers.FloatField(read_only=True)
    days_since_worn = serializers.IntegerField(read_only=True)
    status_label = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = GarmentItem
        fields = [
            "id", "name", "brand",
            "category", "category_name", "category_slot",
            "display_image_url", "primary_color_hex", "primary_color_name",
            "status", "status_label", "is_favorite",
            "storage_location", "location_path",
            "wear_count", "last_worn_date", "days_since_worn",
            "purchase_price", "currency", "cost_per_wear",
            "created_at",
        ]


class GarmentItemSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source="category.name", read_only=True)
    category_slot = serializers.CharField(source="category.slot", read_only=True)
    display_image_url = serializers.CharField(read_only=True)
    location_path = serializers.CharField(read_only=True)
    cost_per_wear = serializers.FloatField(read_only=True)
    days_since_worn = serializers.IntegerField(read_only=True)
    is_wearable_now = serializers.BooleanField(read_only=True)
    status_label = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = GarmentItem
        fields = [
            "id", "name", "brand", "size", "material", "pattern",
            "category", "category_name", "category_slot",
            "primary_color_hex", "primary_color_name", "secondary_color_hex",
            "seasons", "occasions", "warmth_level", "is_waterproof",
            "storage_location", "location_path",
            "original_image_url", "original_image_public_id",
            "clean_image_url", "clean_image_public_id", "display_image_url",
            "status", "status_label", "is_wearable_now", "is_favorite",
            "purchase_price", "currency", "purchase_date",
            "wear_count", "last_worn_date", "days_since_worn", "cost_per_wear",
            "notes", "created_at", "updated_at",
        ]
        read_only_fields = [
            "id",
            # Wear stats move through mark_worn() only.
            "wear_count", "last_worn_date",
            "created_at", "updated_at",
        ]
        extra_kwargs = {
            # public_id values are minted by POST /api/wardrobe/upload/, the only
            # endpoint that writes to Cloudinary. validate() below checks the
            # client is naming its own upload.
            "original_image_public_id": {"write_only": True},
            "clean_image_public_id": {"write_only": True},
        }

    def validate_storage_location(self, value: StorageLocation | None):
        if value is None:
            return value
        request = self.context.get("request")
        if request and value.owner_id != request.user.id:
            raise serializers.ValidationError("That storage location belongs to another account.")
        return value

    def validate_category(self, value: Category):
        """Built-in categories (owner NULL) are usable by every account."""
        request = self.context.get("request")
        if value.owner_id is not None and request and value.owner_id != request.user.id:
            raise serializers.ValidationError("That category belongs to another account.")
        return value

    def validate_primary_color_hex(self, value: str) -> str:
        return _validate_hex(value)

    def validate_secondary_color_hex(self, value: str) -> str:
        return _validate_hex(value)

    def validate(self, attrs):
        """
        The upload endpoint files images under `.../garments/clean/u<user id>/`, so
        the public_id prefix is proof enough that an attached image came from this
        account.
        """
        from apps.vision import storage

        request = self.context.get("request")
        if not request:
            return attrs

        pairs = [
            ("original_image_public_id", "original_image_url", storage.Folder.GARMENT_ORIGINAL),
            ("clean_image_public_id", "clean_image_url", storage.Folder.GARMENT_CLEAN),
        ]

        for id_field, url_field, folder in pairs:
            public_id = attrs.get(id_field)
            if not public_id:
                continue
            if not storage.owns_public_id(public_id, folder, request.user.id):
                raise serializers.ValidationError(
                    {id_field: "That image was uploaded by another account."}
                )
            if not attrs.get(url_field):
                raise serializers.ValidationError(
                    {url_field: "Send the URL that the upload endpoint returned alongside it."}
                )

        return attrs


def _validate_hex(value: str) -> str:
    if not value:
        return value
    value = value.strip()
    if not value.startswith("#"):
        value = f"#{value}"
    if len(value) != 7:
        raise serializers.ValidationError("Use a 6-digit hex colour, e.g. #1a2b3c")
    try:
        int(value[1:], 16)
    except ValueError:
        raise serializers.ValidationError("That is not a valid hex colour.") from None
    return value.lower()


class MarkWornSerializer(serializers.Serializer):
    date = serializers.DateField(
        required=False,
        help_text="Defaults to today. Send a past date to record an earlier wear.",
    )


class ImageUploadRequestSerializer(serializers.Serializer):
    """Describes the multipart body of POST /api/wardrobe/upload/."""

    image = serializers.ImageField(help_text="JPG, PNG or WebP. Maximum 12 MB.")


class DetectedAttributesSerializer(serializers.Serializer):
    primary_color_hex = serializers.CharField()
    primary_color_name = serializers.CharField()
    width = serializers.IntegerField()
    height = serializers.IntegerField()


class ImageUploadResponseSerializer(serializers.Serializer):
    """The four image fields go straight into POST /api/wardrobe/items/."""

    original_image_url = serializers.URLField()
    original_image_public_id = serializers.CharField()
    clean_image_url = serializers.URLField()
    clean_image_public_id = serializers.CharField()
    detected = DetectedAttributesSerializer()
    processing_ms = serializers.IntegerField(help_text="Background-removal time in milliseconds.")
    coverage = serializers.FloatField(help_text="Share of the frame the garment fills, from 0 to 1.")
    warning = serializers.CharField(allow_null=True)


class BulkLocationSerializer(serializers.Serializer):
    item_ids = serializers.ListField(child=serializers.IntegerField(), allow_empty=False)
    storage_location = serializers.PrimaryKeyRelatedField(
        queryset=StorageLocation.objects.all(), allow_null=True
    )
