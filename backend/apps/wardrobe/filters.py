"""Filter labels in this module are published in the schema served at /api/docs/."""

from __future__ import annotations

from django.contrib.postgres.search import TrigramWordSimilarity
from django.db import connection
from django.db.models import Q
from django.db.models.functions import Greatest
from django.utils import timezone
from django_filters import rest_framework as filters
from rest_framework.filters import SearchFilter

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


class SpellingTolerantSearch(SearchFilter):
    """
    Ordinary substring matching, with a second pass for misspelled words.

    Typing "snekers" matches nothing with a plain LIKE, and an empty closet
    screen reads as lost data rather than a typo. When the first pass comes
    back empty the same words are compared letter-group by letter-group
    against the fields below, which still finds "Blue Sneakers".

    The second pass only runs on an empty result, so a search that already
    works costs one extra EXISTS query.
    """

    # Measured against real misspellings: a correct match scores 0.40 upwards
    # and an unrelated item stays at 0.25 or below.
    THRESHOLD = 0.3

    # Two letters match too much. "j" alone scores 0.50 against both "Jeans"
    # and "Jacket", which would return half the closet.
    MIN_LENGTH = 3

    FUZZY_FIELDS = ["name", "brand", "primary_color_name", "category__name"]

    def filter_queryset(self, request, queryset, view):
        matched = super().filter_queryset(request, queryset, view)
        if connection.vendor != "postgresql":
            return matched

        terms = [term for term in self.get_search_terms(request) if len(term) >= self.MIN_LENGTH]
        if not terms or matched.exists():
            return matched

        score = None
        for term in terms:
            for field in self.FUZZY_FIELDS:
                similarity = TrigramWordSimilarity(term, field)
                score = similarity if score is None else Greatest(score, similarity)

        # The screen tells the reader these are guesses rather than matches.
        request.spelling_guessed = True
        return queryset.annotate(_match=score).filter(_match__gte=self.THRESHOLD)
