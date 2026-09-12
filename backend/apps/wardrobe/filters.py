"""Filter labels in this module are published in the schema served at /api/docs/."""

from __future__ import annotations

from django.db.models import Q
from django.utils import timezone
from django_filters import rest_framework as filters

from .models import Category, GarmentItem, StorageLocation


class GarmentItemFilter(filters.FilterSet):
    category = filters.NumberFilter(field_name="category_id")
    status = filters.ChoiceFilter(choices=GarmentItem.Status.choices)
    brand = filters.CharFilter(lookup_expr="icontains")
    is_favorite = filters.BooleanFilter()
    color = filters.CharFilter(field_name="primary_color_name", lookup_expr="iexact")

    slot = filters.ChoiceFilter(
        field_name="category__slot",
        choices=Category.Slot.choices,
        label="Outfit slot (TOP, BOTTOM, FOOTWEAR...)",
    )

    location = filters.ModelChoiceFilter(
        queryset=StorageLocation.objects.none(),   # narrowed per user in __init__
        method="filter_location",
        label="Storage location (includes everything nested inside it)",
    )

    season = filters.CharFilter(
        method="filter_season",
        label="Items suitable for this season (items with no season set always match)",
    )
    occasion = filters.CharFilter(method="filter_occasion")

    unworn_days = filters.NumberFilter(
        method="filter_unworn_days",
        label="Not worn for at least this many days (never-worn items count)",
    )

    wearable = filters.BooleanFilter(
        method="filter_wearable",
        label="Only items available to wear right now",
    )

    has_image = filters.BooleanFilter(method="filter_has_image")
    no_location = filters.BooleanFilter(
        field_name="storage_location", lookup_expr="isnull",
        label="Items whose storage place has not been recorded",
    )

    class Meta:
        model = GarmentItem
        fields = ["category", "status", "brand", "is_favorite", "slot"]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        request = getattr(self, "request", None)
        if request and request.user.is_authenticated:
            self.filters["location"].queryset = StorageLocation.objects.filter(
                owner=request.user
            )

    def filter_location(self, queryset, name, value: StorageLocation):
        return queryset.filter(storage_location_id__in=value.descendant_ids())

    def filter_season(self, queryset, name, value: str):
        """
        An item with no seasons recorded counts as all-year. Excluding those
        would empty most filtered views, which reads as missing data.
        """
        return queryset.filter(Q(seasons__contains=[value.upper()]) | Q(seasons=[]))

    def filter_occasion(self, queryset, name, value: str):
        return queryset.filter(Q(occasions__contains=[value.upper()]) | Q(occasions=[]))

    def filter_unworn_days(self, queryset, name, value):
        cutoff = timezone.localdate() - timezone.timedelta(days=int(value))
        return queryset.filter(Q(last_worn_date__lt=cutoff) | Q(last_worn_date__isnull=True))

    def filter_wearable(self, queryset, name, value: bool):
        if value:
            return queryset.filter(status__in=GarmentItem.WEARABLE_STATUSES)
        return queryset.exclude(status__in=GarmentItem.WEARABLE_STATUSES)

    def filter_has_image(self, queryset, name, value: bool):
        has = Q(clean_image_url__gt="") | Q(original_image_url__gt="")
        return queryset.filter(has) if value else queryset.exclude(has)
