"""Shapes for what is on sale, and for how old that answer is."""

from __future__ import annotations

from django.utils import timezone
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from apps.wardrobe.models import Category

from .filters import JUST_DROPPED_DAYS
from .models import Deal, Shop


class ShopSerializer(serializers.ModelSerializer):
    last_result_label = serializers.CharField(source="get_last_result_display", read_only=True)
    deal_count = serializers.SerializerMethodField()

    class Meta:
        model = Shop
        fields = [
            "id", "name", "slug", "site_url", "currency",
            "last_checked_at", "last_result", "last_result_label", "deal_count",
        ]

    @extend_schema_field(serializers.IntegerField)
    def get_deal_count(self, obj) -> int:
        # Annotated by the view. A shop serialized on its own has not been
        # counted, and zero is a safer answer than a query per row.
        return getattr(obj, "listed_count", 0)


class DealSerializer(serializers.ModelSerializer):
    shop_name = serializers.CharField(source="shop.name", read_only=True)
    shop_slug = serializers.CharField(source="shop.slug", read_only=True)
    currency = serializers.CharField(source="shop.currency", read_only=True)

    category_name = serializers.SerializerMethodField()
    slot_label = serializers.SerializerMethodField()
    audience_label = serializers.CharField(source="get_audience_display", read_only=True)
    saving = serializers.SerializerMethodField()
    just_dropped = serializers.SerializerMethodField()

    class Meta:
        model = Deal
        fields = [
            "id", "title", "url", "image_url", "vendor",
            "shop_name", "shop_slug", "currency",
            "shop_category", "category", "category_name", "slot", "slot_label",
            "color_name", "color_hex", "audience", "audience_label",
            "price", "was_price", "discount_percent", "saving",
            "sizes", "in_stock",
            "checked_at", "price_fell_at", "just_dropped",
        ]

    @extend_schema_field(serializers.CharField)
    def get_category_name(self, obj) -> str:
        return obj.category.name if obj.category_id else ""

    @extend_schema_field(serializers.CharField)
    def get_slot_label(self, obj) -> str:
        try:
            return Category.Slot(obj.slot).label
        except ValueError:
            return ""

    @extend_schema_field(serializers.CharField(allow_null=True))
    def get_saving(self, obj):
        saving = obj.saving
        return None if saving is None else str(saving)

    @extend_schema_field(serializers.BooleanField)
    def get_just_dropped(self, obj) -> bool:
        if obj.price_fell_at is None:
            return False
        return obj.price_fell_at >= timezone.now() - timezone.timedelta(days=JUST_DROPPED_DAYS)


class PriceChangeSerializer(serializers.Serializer):
    price = serializers.DecimalField(max_digits=10, decimal_places=2)
    was_price = serializers.DecimalField(max_digits=10, decimal_places=2, allow_null=True)
    noticed_at = serializers.DateTimeField()


class FreshnessSerializer(serializers.Serializer):
    """How old the prices are, said plainly enough to print."""

    checked_at = serializers.DateTimeField(
        allow_null=True,
        help_text="The oldest check among the working shops, so it is never flattering.",
    )
    is_stale = serializers.BooleanField(help_text="True once the prices are older than we will vouch for.")
    stale_after_hours = serializers.IntegerField()
    summary = serializers.CharField(help_text="Ready to show, e.g. 'Prices checked 2 hours ago'.")
    shops_working = serializers.IntegerField()
    shops_total = serializers.IntegerField()
    deals_listed = serializers.IntegerField()
    deals_on_sale = serializers.IntegerField()
    shops = ShopSerializer(many=True)


class FacetSerializer(serializers.Serializer):
    """One choice in a filter, with how many things it would leave."""

    value = serializers.CharField()
    label = serializers.CharField()
    count = serializers.IntegerField()


class FiltersSerializer(serializers.Serializer):
    """Everything the filter panel needs, counted against what is actually listed."""

    audiences = FacetSerializer(many=True)
    slots = FacetSerializer(many=True)
    categories = FacetSerializer(many=True)
    shops = FacetSerializer(many=True)
    colors = FacetSerializer(many=True)
    sizes = FacetSerializer(many=True)
    price_floor = serializers.IntegerField()
    price_ceiling = serializers.IntegerField()
