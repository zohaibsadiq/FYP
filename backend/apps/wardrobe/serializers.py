"""
`owner` is never accepted from the request body. Every view sets it from
request.user.
"""

from __future__ import annotations

from django.utils import timezone
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from .models import Category, GarmentItem, StorageLocation, WearEvent


def _still_owned(items):
    """Counts describe what somebody has, so sold and put-away things are out."""
    return items.exclude(status__in=GarmentItem.GONE_STATUSES)


def _item_count(obj, related) -> int:
    """
    The list views annotate item_count. A row that has just been created has not
    been through that queryset, and DRF drops a read-only field whose attribute
    is missing instead of raising, so the response would quietly change shape
    between POST and GET.
    """
    annotated = getattr(obj, "item_count", None)
    return annotated if annotated is not None else _still_owned(related).count()


class CategorySerializer(serializers.ModelSerializer):
    slot_label = serializers.CharField(source="get_slot_display", read_only=True)
    is_system = serializers.BooleanField(read_only=True)
    item_count = serializers.SerializerMethodField()

    class Meta:
        model = Category
        fields = ["id", "name", "slot", "slot_label", "icon", "sort_order", "is_system", "item_count"]
        read_only_fields = ["id", "is_system", "item_count"]

    def get_item_count(self, obj: Category) -> int:
        request = self.context.get("request")
        owned = obj.items.filter(owner=request.user) if request else obj.items
        return _item_count(obj, owned)

    def validate(self, attrs):
        """
        unique_category_per_owner is enforced by the database, and owner is never
        a serializer field, so DRF cannot build its own check for it. Without
        this the second one raises IntegrityError and the request 500s.
        """
        request = self.context.get("request")
        if not request:
            return attrs

        name = attrs.get("name", getattr(self.instance, "name", ""))
        clash = Category.objects.filter(owner=request.user, name__iexact=name.strip())
        if self.instance:
            clash = clash.exclude(pk=self.instance.pk)
        if clash.exists():
            raise serializers.ValidationError(
                {"name": f"You already have a category called {name.strip()}."}
            )
        return attrs


class StorageLocationSerializer(serializers.ModelSerializer):
    full_path = serializers.CharField(read_only=True)
    depth = serializers.IntegerField(read_only=True)
    kind_label = serializers.CharField(source="get_kind_display", read_only=True)
    item_count = serializers.SerializerMethodField()

    def get_item_count(self, obj: StorageLocation) -> int:
        return _item_count(obj, obj.items)

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
        owner = self.context["request"].user

        instance = StorageLocation(**{**self._current_values(), **attrs})
        instance.pk = self.instance.pk if self.instance else None
        instance.owner = owner
        instance.clean()

        # unique_location_name_per_parent lives in the database, and owner is
        # never a serializer field, so DRF cannot build its own check for it.
        # Naming two drawers the same is an ordinary slip, and without this it
        # raises IntegrityError and the request 500s.
        clash = StorageLocation.objects.filter(
            owner=owner, parent=instance.parent, name__iexact=instance.name.strip()
        )
        if self.instance:
            clash = clash.exclude(pk=self.instance.pk)
        if clash.exists():
            where = instance.parent.full_path if instance.parent else "your places"
            raise serializers.ValidationError(
                {"name": f"There is already a {instance.name.strip()} in {where}."}
            )
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
        """
        Items directly in this location, not counting sub-locations. The view
        prefetches these already filtered, so len() reads the cache rather than
        firing one more query for every branch of the tree.
        """
        return len(obj.items.all())


class GarmentItemListSerializer(serializers.ModelSerializer):
    """Fewer fields than the detail serializer; the closet grid loads 24 at a time."""

    category_name = serializers.CharField(source="category.name", read_only=True)
    category_slot = serializers.CharField(source="category.slot", read_only=True)
    display_image_url = serializers.CharField(read_only=True)
    location_path = serializers.CharField(read_only=True)
    cost_per_wear = serializers.FloatField(read_only=True)
    days_since_worn = serializers.IntegerField(read_only=True)
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    last_worn_note = serializers.SerializerMethodField()

    class Meta:
        model = GarmentItem
        fields = [
            "id", "name", "brand",
            "category", "category_name", "category_slot",
            "display_image_url", "primary_color_hex", "primary_color_name",
            "status", "status_label", "is_favorite", "is_lendable",
            "storage_location", "location_path",
            "wear_count", "last_worn_date", "days_since_worn", "last_worn_note",
            "purchase_price", "currency", "cost_per_wear",
            "created_at",
        ]

    @extend_schema_field(serializers.CharField)
    def get_last_worn_note(self, obj: GarmentItem) -> str:
        """
        Empty unless the queryset was built with with_last_occasion(). A plain
        field would be dropped from the response entirely when the annotation
        is missing, which reads to the client as the field never existing.
        """
        return getattr(obj, "last_worn_note", "") or ""


class GarmentItemSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source="category.name", read_only=True)
    category_slot = serializers.CharField(source="category.slot", read_only=True)
    display_image_url = serializers.CharField(read_only=True)
    location_path = serializers.CharField(read_only=True)
    cost_per_wear = serializers.FloatField(read_only=True)
    days_since_worn = serializers.IntegerField(read_only=True)
    last_worn_note = serializers.SerializerMethodField()
    is_wearable_now = serializers.BooleanField(read_only=True)
    status_label = serializers.CharField(source="get_status_display", read_only=True)

    @extend_schema_field(serializers.CharField)
    def get_last_worn_note(self, obj: GarmentItem) -> str:
        """Same as the list serializer: never dropped, empty when unannotated."""
        return getattr(obj, "last_worn_note", "") or ""

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
            "status", "status_label", "is_wearable_now", "is_favorite", "is_lendable",
            "purchase_price", "currency", "purchase_date",
            "wear_count", "last_worn_date", "days_since_worn", "last_worn_note", "cost_per_wear",
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

    def update(self, instance, validated_data):
        """Cloudinary bills for stored bytes, and a replaced photo is nobody's."""
        from apps.vision import storage

        was = {instance.original_image_public_id, instance.clean_image_public_id}
        item = super().update(instance, validated_data)
        now = {item.original_image_public_id, item.clean_image_public_id}

        for public_id in was - now:
            if public_id:
                storage.delete_image(public_id)
        return item


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
    note = serializers.CharField(
        required=False,
        allow_blank=True,
        max_length=200,
        help_text="Optional, e.g. 'Ayesha's mehndi'.",
    )

    def validate_date(self, value):
        if value > timezone.localdate():
            raise serializers.ValidationError("That day has not happened yet.")
        return value


class WearEventSerializer(serializers.ModelSerializer):
    """One day an item was worn, with enough about the item to draw a row."""

    item_name = serializers.CharField(source="item.name", read_only=True)
    item_image_url = serializers.CharField(source="item.display_image_url", read_only=True)
    item_slot = serializers.CharField(source="item.category.slot", read_only=True)
    days_ago = serializers.SerializerMethodField()

    class Meta:
        model = WearEvent
        fields = [
            "id", "item", "item_name", "item_image_url", "item_slot",
            "worn_on", "note", "days_ago", "created_at",
        ]
        read_only_fields = ["id", "created_at"]
        # The one built from the unique constraint reads "the fields item,
        # worn_on must make a unique set", which means nothing to the person
        # looking at it. validate() below says the same thing in words.
        validators = []

    @extend_schema_field(serializers.IntegerField)
    def get_days_ago(self, obj: WearEvent) -> int:
        return (timezone.localdate() - obj.worn_on).days

    def validate_worn_on(self, value):
        if value > timezone.localdate():
            raise serializers.ValidationError("That day has not happened yet.")
        return value

    def validate_item(self, value: GarmentItem):
        owner = self.context["request"].user
        if value.owner_id != owner.id:
            raise serializers.ValidationError("That item is not in your closet.")
        return value

    def validate(self, attrs):
        item = attrs.get("item") or getattr(self.instance, "item", None)
        worn_on = attrs.get("worn_on") or getattr(self.instance, "worn_on", None)
        clash = WearEvent.objects.filter(item=item, worn_on=worn_on)
        if self.instance:
            clash = clash.exclude(pk=self.instance.pk)
        if clash.exists():
            raise serializers.ValidationError(
                {"worn_on": f"{item.name} is already recorded as worn on {worn_on}."}
            )
        return attrs


class ImageUploadRequestSerializer(serializers.Serializer):
    """Describes the multipart body of POST /api/wardrobe/upload/."""

    image = serializers.ImageField(help_text="JPG, PNG or WebP. Maximum 12 MB.")


class ImageDiscardSerializer(serializers.Serializer):
    """Body of POST /api/wardrobe/upload/discard/."""

    public_ids = serializers.ListField(
        child=serializers.CharField(max_length=255),
        min_length=1,
        max_length=4,
        help_text="The public_id values the upload endpoint returned.",
    )


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
