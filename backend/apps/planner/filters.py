"""Filter labels in this module are published in the schema served at /api/docs/."""

from __future__ import annotations

from django_filters import rest_framework as filters

from .models import PlannedOutfit


class PlannedOutfitFilter(filters.FilterSet):
    on = filters.DateFilter(field_name="planned_for", label="A single day (YYYY-MM-DD)")
    since = filters.DateFilter(field_name="planned_for", lookup_expr="gte")
    until = filters.DateFilter(field_name="planned_for", lookup_expr="lte")
    confirmed = filters.BooleanFilter(
        field_name="worn_confirmed_at",
        lookup_expr="isnull",
        exclude=True,
        label="Only days already confirmed as worn",
    )

    class Meta:
        model = PlannedOutfit
        fields = ["on", "since", "until", "confirmed"]
