"""
The label on each filter is shown on the API docs page at /api/docs/, which is
why they are written as full sentences.
"""

from __future__ import annotations

from django_filters import rest_framework as filters

from apps.wardrobe.models import Category

from .models import Listing


class ListingFilter(filters.FilterSet):
    city = filters.CharFilter(
        field_name="city",
        lookup_expr="iexact",
        label="Only things in one city, e.g. Lahore",
    )
    near_me = filters.BooleanFilter(
        method="filter_near_me",
        label="Only things in the same city as me",
    )

    slot = filters.ChoiceFilter(
        field_name="item__category__slot",
        choices=Category.Slot.choices,
        label="Where it is worn: TOP, BOTTOM, FOOTWEAR and so on",
    )
    category = filters.NumberFilter(field_name="item__category_id", label="Category id")
    size = filters.CharFilter(
        field_name="item__size",
        lookup_expr="iexact",
        label="Size, as the seller wrote it",
    )
    color = filters.CharFilter(
        field_name="item__primary_color_name",
        lookup_expr="iexact",
        label="Colour name, e.g. Navy",
    )
    brand = filters.CharFilter(field_name="item__brand", lookup_expr="icontains")

    condition = filters.ChoiceFilter(
        choices=Listing.Condition.choices,
        label="How worn it is",
    )
    audience = filters.ChoiceFilter(
        choices=Listing.Audience.choices,
        label="Who it would suit: WOMEN, MEN, KIDS",
    )
    min_price = filters.NumberFilter(field_name="asking_price", lookup_expr="gte")
    max_price = filters.NumberFilter(field_name="asking_price", lookup_expr="lte")

    class Meta:
        model = Listing
        fields = [
            "city", "near_me", "slot", "category", "size", "color", "brand",
            "condition", "audience", "min_price", "max_price",
        ]

    def filter_near_me(self, queryset, name, value):
        if not value:
            return queryset
        city = (getattr(self.request.user, "city", "") or "").strip()
        # Somebody who has not said where they live cannot be near anything.
        # Without this, an empty city would match every listing that also has
        # no city.
        return queryset.filter(city__iexact=city) if city else queryset.none()
