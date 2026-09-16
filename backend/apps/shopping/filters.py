"""Filter labels in this module are published in the schema served at /api/docs/."""

from __future__ import annotations

from django.db.models import Q
from django.utils import timezone
from django_filters import rest_framework as filters

from apps.wardrobe.models import Category

from . import advice
from .models import Deal

# A price drop stops being news after a week, and a shop that refreshes daily
# would otherwise have everything flagged as new forever.
JUST_DROPPED_DAYS = 7

# The same clamp the wardrobe uses. A day count large enough to overflow a date
# calculation is a mistake, not a query, and it should not reach the database.
MAX_DAYS_BACK = 3650


def _sane_days(value) -> int:
    return max(0, min(int(value), MAX_DAYS_BACK))


class DealFilter(filters.FilterSet):
    shop = filters.CharFilter(
        field_name="shop__slug",
        lookup_expr="iexact",
        label="Shop, by its short name",
    )
    slot = filters.ChoiceFilter(
        choices=Category.Slot.choices,
        label="Where it is worn: TOP, BOTTOM, FOOTWEAR and so on",
    )
    category = filters.NumberFilter(field_name="category_id", label="Category id")
    color = filters.CharFilter(
        field_name="color_name",
        lookup_expr="iexact",
        label="Colour name, e.g. Navy",
    )
    size = filters.CharFilter(method="filter_size", label="A size still in stock, e.g. M")

    min_price = filters.NumberFilter(field_name="price", lookup_expr="gte")
    max_price = filters.NumberFilter(field_name="price", lookup_expr="lte")
    min_discount = filters.NumberFilter(
        field_name="discount_percent",
        lookup_expr="gte",
        label="Only cuts of at least this many percent",
    )

    on_sale = filters.BooleanFilter(method="filter_on_sale", label="Only things marked down")
    in_stock = filters.BooleanFilter(field_name="in_stock", label="Only what can be bought today")
    just_dropped = filters.BooleanFilter(
        method="filter_just_dropped",
        label=f"Only prices that fell in the last {JUST_DROPPED_DAYS} days",
    )

    fills_gap = filters.BooleanFilter(
        method="filter_fills_gap",
        label="Only things for a part of the closet that is empty",
    )
    hide_owned = filters.BooleanFilter(
        method="filter_hide_owned",
        label="Leave out anything close to something already owned",
    )

    dropped_days = filters.NumberFilter(
        method="filter_dropped_days",
        label="Prices that fell in the last N days",
    )

    class Meta:
        model = Deal
        fields = [
            "shop", "slot", "category", "color", "size",
            "min_price", "max_price", "min_discount",
            "on_sale", "in_stock", "just_dropped", "fills_gap", "hide_owned",
        ]

    def filter_size(self, queryset, name, value):
        size = (value or "").strip()
        if not size:
            return queryset
        # Sizes are held as the shop spells them, so both cases are tried
        # rather than forcing every shop into one house style.
        return queryset.filter(Q(sizes__contains=[size.upper()]) | Q(sizes__contains=[size]))

    def filter_on_sale(self, queryset, name, value):
        if value is None:
            return queryset
        return queryset.filter(discount_percent__gt=0) if value else queryset.filter(discount_percent=0)

    def filter_just_dropped(self, queryset, name, value):
        if not value:
            return queryset
        since = timezone.now() - timezone.timedelta(days=JUST_DROPPED_DAYS)
        return queryset.filter(price_fell_at__gte=since)

    def filter_dropped_days(self, queryset, name, value):
        if value in (None, ""):
            return queryset
        since = timezone.now() - timezone.timedelta(days=_sane_days(value))
        return queryset.filter(price_fell_at__gte=since)

    def filter_fills_gap(self, queryset, name, value):
        if not value:
            return queryset
        slots = advice.empty_slots(self._closet())
        # Nothing is a gap for somebody who owns something everywhere, and an
        # empty answer is the honest one.
        return queryset.filter(slot__in=slots) if slots else queryset.none()

    def filter_hide_owned(self, queryset, name, value):
        if not value:
            return queryset
        unwanted = Q()
        for slot, names in advice.owned_color_names(self._closet()).items():
            unwanted |= Q(slot=slot, color_name__in=names)
        return queryset.exclude(unwanted) if unwanted else queryset

    def _closet(self):
        """
        Read once even when both closet filters are used together.

        The schema generator builds this class without a request, so an empty
        closet is the answer there rather than an error.
        """
        if not hasattr(self, "_closet_cache"):
            user = getattr(self.request, "user", None)
            self._closet_cache = (
                advice.closet_for(user)
                if user is not None and user.is_authenticated
                else advice.Closet([])
            )
        return self._closet_cache
