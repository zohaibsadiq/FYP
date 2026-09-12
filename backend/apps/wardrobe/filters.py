"""
Filters for the closet grid.

These turn URL query strings into database queries:

    /api/wardrobe/items/?slot=TOP&status=IN_WARDROBE&season=WINTER
    /api/wardrobe/items/?location=3&unworn_days=100
    /api/wardrobe/items/?search=denim

Writing them here rather than inside the view keeps the view tiny and means the
filters are automatically documented on the /api/docs/ page.
"""

from __future__ import annotations

from django.db.models import Q
from django.utils import timezone
from django_filters import rest_framework as filters

from .models import Category, GarmentItem, StorageLocation


class GarmentItemFilter(filters.FilterSet):
    # ---- simple matches ----
    category = filters.NumberFilter(field_name="category_id")
    status = filters.ChoiceFilter(choices=GarmentItem.Status.choices)
    brand = filters.CharFilter(lookup_expr="icontains")
    is_favorite = filters.BooleanFilter()
    color = filters.CharFilter(field_name="primary_color_name", lookup_expr="iexact")

    # ---- derived ----
    slot = filters.ChoiceFilter(
        field_name="category__slot",
        choices=Category.Slot.choices,
        label="Outfit slot (TOP, BOTTOM, FOOTWEAR...)",
    )

    location = filters.ModelChoiceFilter(
        queryset=StorageLocation.objects.none(),   # replaced per-user in __init__
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
        """Limit the location dropdown to the requesting user's own locations."""
        super().__init__(*args, **kwargs)
        request = getattr(self, "request", None)
        if request and request.user.is_authenticated:
            self.filters["location"].queryset = StorageLocation.objects.filter(
                owner=request.user
            )

    # -- methods ------------------------------------------------------------

    def filter_location(self, queryset, name, value: StorageLocation):
        """
        Filtering by "Bedroom" must also return items in the wardrobe inside
        that bedroom, and the drawers inside that wardrobe.
        """
        return queryset.filter(storage_location_id__in=value.descendant_ids())

    def filter_season(self, queryset, name, value: str):
        """
        An item with no seasons recorded is treated as all-year, so it always
        matches. Otherwise every unlabelled item would vanish from a filtered
        view, which looks like data loss to the user.
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
