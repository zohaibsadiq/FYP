"""
Serializers for the wardrobe app.

A rule we follow everywhere: `owner` is NEVER accepted from the request body.
It is always taken from the logged-in user in the view. Otherwise anyone could
POST {"owner": 2} and create items inside someone else's closet.
"""

from __future__ import annotations

from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from .models import Category, GarmentItem, StorageLocation


# ===========================================================================
#  CATEGORY
# ===========================================================================

class CategorySerializer(serializers.ModelSerializer):
    slot_label = serializers.CharField(source="get_slot_display", read_only=True)
    is_system = serializers.BooleanField(read_only=True)
    item_count = serializers.IntegerField(read_only=True)  # annotated in the view

    class Meta:
        model = Category
        fields = ["id", "name", "slot", "slot_label", "icon", "sort_order", "is_system", "item_count"]
        read_only_fields = ["id", "is_system", "item_count"]


# ===========================================================================
#  STORAGE LOCATION
# ===========================================================================

class StorageLocationSerializer(serializers.ModelSerializer):
    """Flat representation - used for lists, dropdowns and writes."""

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
        """Make sure you cannot nest your drawer inside someone else's wardrobe."""
        if value is None:
            return value
        request = self.context.get("request")
        if request and value.owner_id != request.user.id:
            raise serializers.ValidationError("That parent location does not belong to you.")
        return value

    def validate(self, attrs):
        """
        Run the model's own clean() so the loop and depth rules apply to the API
        too, not just the admin panel. One set of rules, enforced everywhere.
        """
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
    """
    Nested representation - used by the storage page to draw the tree.

    `children` calls this same serializer, which is how one class renders a
    structure of any depth.
    """

    children = serializers.SerializerMethodField()
    kind_label = serializers.CharField(source="get_kind_display", read_only=True)
    item_count = serializers.SerializerMethodField()

    class Meta:
        model = StorageLocation
        fields = ["id", "name", "kind", "kind_label", "notes", "item_count", "children"]

    @extend_schema_field(serializers.ListField(child=serializers.DictField()))
    def get_children(self, obj: StorageLocation):
        # `obj.children` is prefetched in the view, so this does not hit the DB
        return StorageLocationTreeSerializer(
            obj.children.all(), many=True, context=self.context
        ).data

    def get_item_count(self, obj: StorageLocation) -> int:
        """Items directly in this location (not counting sub-locations)."""
        return obj.items.count()


# ===========================================================================
#  GARMENT ITEM
# ===========================================================================

class GarmentItemListSerializer(serializers.ModelSerializer):
    """
    The light version, used for the closet grid.

    Deliberately smaller than the detail serializer: a grid of 24 items should
    not ship every field of every item over the network.
    """

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
    """The full version: reading one item, creating, and updating."""

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
            # Wear stats change through mark_worn(), not by editing a number.
            "wear_count", "last_worn_date",
            "created_at", "updated_at",
        ]
        extra_kwargs = {
            # Image fields come from POST /api/wardrobe/upload/, which is the
            # only thing that actually puts files on Cloudinary. validate()
            # below proves the client is referring to its own upload.
            "original_image_public_id": {"write_only": True},
            "clean_image_public_id": {"write_only": True},
        }

    def validate_storage_location(self, value: StorageLocation | None):
        if value is None:
            return value
        request = self.context.get("request")
        if request and value.owner_id != request.user.id:
            raise serializers.ValidationError("That storage location does not belong to you.")
        return value

    def validate_category(self, value: Category):
        """Allow built-in categories (owner=None) and the user's own."""
        request = self.context.get("request")
        if value.owner_id is not None and request and value.owner_id != request.user.id:
            raise serializers.ValidationError("That category does not belong to you.")
        return value

    def validate_primary_color_hex(self, value: str) -> str:
        return _validate_hex(value)

    def validate_secondary_color_hex(self, value: str) -> str:
        return _validate_hex(value)

    def validate(self, attrs):
        """
        Confirm any image the client points at was uploaded by this same user.

        The upload endpoint stores files under `.../garments/clean/u<user id>/`,
        so checking the public_id prefix is enough to stop someone attaching
        another person's photo to their own item.
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
                    {id_field: "That image was not uploaded by you."}
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


# ===========================================================================
#  ACTION PAYLOADS (small serializers just for documenting request bodies)
# ===========================================================================

class MarkWornSerializer(serializers.Serializer):
    date = serializers.DateField(
        required=False,
        help_text="Defaults to today. Use this to log something you wore yesterday.",
    )


class ImageUploadRequestSerializer(serializers.Serializer):
    """Documents the multipart body of POST /api/wardrobe/upload/."""

    image = serializers.ImageField(help_text="JPG, PNG or WebP. Maximum 12 MB.")


class DetectedAttributesSerializer(serializers.Serializer):
    primary_color_hex = serializers.CharField()
    primary_color_name = serializers.CharField()
    width = serializers.IntegerField()
    height = serializers.IntegerField()


class ImageUploadResponseSerializer(serializers.Serializer):
    """
    What the upload endpoint returns. Pass these four image fields straight
    into POST /api/wardrobe/items/ to create the garment.
    """

    original_image_url = serializers.URLField()
    original_image_public_id = serializers.CharField()
    clean_image_url = serializers.URLField()
    clean_image_public_id = serializers.CharField()
    detected = DetectedAttributesSerializer()
    processing_ms = serializers.IntegerField(help_text="Background-removal time, for the evaluation chapter.")
    coverage = serializers.FloatField(help_text="0-1: how much of the frame the garment fills.")
    warning = serializers.CharField(allow_null=True)


class BulkLocationSerializer(serializers.Serializer):
    """Move several items into one drawer at once."""

    item_ids = serializers.ListField(child=serializers.IntegerField(), allow_empty=False)
    storage_location = serializers.PrimaryKeyRelatedField(
        queryset=StorageLocation.objects.all(), allow_null=True
    )
