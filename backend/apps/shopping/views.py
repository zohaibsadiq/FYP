from __future__ import annotations

from collections import Counter

from django.db.models import Count, Max, Min, Q
from django.utils import timezone
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.wardrobe.models import Category

from .filters import DealFilter
from .models import Deal, Shop
from .serializers import (
    DealSerializer,
    FiltersSerializer,
    FreshnessSerializer,
    PriceChangeSerializer,
    ShopSerializer,
)

# Prices older than this are still shown, but the screen is told to say so.
# A day is generous for clothing, where a sale runs for weeks.
STALE_AFTER_HOURS = 24

# How many different sizes and colours the filter panel offers before it stops
# being a filter and starts being a list of everything.
FACET_LIMIT = 24


def _ago(when) -> str:
    """'just now', '2 hours ago', '3 days ago'. Deliberately rounded down."""
    if when is None:
        return "not yet"

    seconds = (timezone.now() - when).total_seconds()
    if seconds < 90:
        return "just now"
    minutes = int(seconds // 60)
    if minutes < 60:
        return f"{minutes} minutes ago"
    hours = minutes // 60
    if hours < 24:
        return "1 hour ago" if hours == 1 else f"{hours} hours ago"
    days = hours // 24
    return "yesterday" if days == 1 else f"{days} days ago"


@extend_schema_view(
    list=extend_schema(
        tags=["Shopping"],
        summary="Clothes on sale in real shops, matched against your closet",
        description=(
            "Read from our own copy of each shop's published catalogue, "
            "refreshed on a schedule. Nothing is fetched from a shop while the "
            "request is being answered, so a shop being down slows nothing "
            "down and every row carries the moment it was really checked."
        ),
    ),
    retrieve=extend_schema(tags=["Shopping"], summary="One product, as last seen"),
)
class DealViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = DealSerializer
    filterset_class = DealFilter
    search_fields = ["title", "vendor", "shop_category", "color_name"]
    ordering_fields = ["discount_percent", "price", "checked_at", "price_fell_at", "first_seen_at"]
    ordering = ["-discount_percent", "price"]

    def get_queryset(self):
        # Delisted rows stay in the table for their price history, but offering
        # somebody a link to a page a shop has taken down is worse than showing
        # them nothing.
        return Deal.objects.listed().select_related("shop", "category")

    @extend_schema(
        tags=["Shopping"],
        summary="Every price this product has been seen at",
        responses=PriceChangeSerializer(many=True),
    )
    @action(detail=True, methods=["get"], url_path="price-history")
    def price_history(self, request, pk=None):
        deal = self.get_object()
        changes = deal.price_changes.all()[:50]
        return Response(PriceChangeSerializer(changes, many=True).data)


@extend_schema(
    tags=["Shopping"],
    summary="How old the prices are",
    description=(
        "The age given is the oldest check among the shops that are working, "
        "so it never flatters. A shop whose last refresh failed keeps the time "
        "of the last one that worked, because a failed attempt did not make "
        "any price newer."
    ),
    responses=FreshnessSerializer,
)
class FreshnessView(APIView):
    def get(self, request):
        shops = list(
            Shop.objects.filter(is_active=True).annotate(
                listed_count=Count("deals", filter=Q(deals__is_listed=True))
            )
        )
        checked = [shop.last_checked_at for shop in shops if shop.last_checked_at]
        oldest = min(checked) if checked else None

        listed = Deal.objects.listed()
        totals = listed.aggregate(
            all_of_them=Count("id"),
            reduced=Count("id", filter=Q(discount_percent__gt=0)),
        )

        is_stale = oldest is None or oldest < timezone.now() - timezone.timedelta(
            hours=STALE_AFTER_HOURS
        )
        if oldest is None:
            summary = "Prices have not been checked yet."
        elif is_stale:
            summary = f"Prices were last checked {_ago(oldest)} and may have moved since."
        else:
            summary = f"Prices checked {_ago(oldest)}."

        return Response({
            "checked_at": oldest,
            "is_stale": is_stale,
            "stale_after_hours": STALE_AFTER_HOURS,
            "summary": summary,
            "shops_working": sum(1 for shop in shops if shop.last_result == Shop.Result.OK),
            "shops_total": len(shops),
            "deals_listed": totals["all_of_them"],
            "deals_on_sale": totals["reduced"],
            "shops": ShopSerializer(shops, many=True).data,
        })


@extend_schema(
    tags=["Shopping"],
    summary="The choices the filter panel can offer, with how many each would leave",
    description=(
        "Counted across everything currently listed, not across the filters "
        "already applied, so a choice never disappears just because another "
        "one is switched on."
    ),
    responses=FiltersSerializer,
)
class FilterOptionsView(APIView):
    def get(self, request):
        listed = Deal.objects.listed()

        # Everything, women, men, kids. Counted so a tab that would show an
        # empty page can say so before it is tapped.
        audiences = [
            {
                "value": row["audience"],
                "label": Deal.Audience(row["audience"]).label,
                "count": row["n"],
            }
            for row in listed.values("audience").annotate(n=Count("id")).order_by("-n")
        ]

        slots = [
            {"value": row["slot"], "label": _slot_label(row["slot"]), "count": row["n"]}
            for row in listed.values("slot").annotate(n=Count("id")).order_by("-n")
            if row["slot"]
        ]

        categories = [
            {
                "value": str(row["category_id"]),
                "label": row["category__name"],
                "count": row["n"],
            }
            for row in listed.exclude(category__isnull=True)
            .values("category_id", "category__name")
            .annotate(n=Count("id"))
            .order_by("-n")[:FACET_LIMIT]
        ]

        shops = [
            {"value": row["shop__slug"], "label": row["shop__name"], "count": row["n"]}
            for row in listed.values("shop__slug", "shop__name")
            .annotate(n=Count("id"))
            .order_by("-n")
        ]

        colors = [
            {"value": row["color_name"], "label": row["color_name"], "count": row["n"]}
            for row in listed.exclude(color_name="")
            .values("color_name")
            .annotate(n=Count("id"))
            .order_by("-n")[:FACET_LIMIT]
        ]

        # Sizes live in an array on each row, so they are counted here rather
        # than grouped in the database. Only the labels are read back.
        tally: Counter = Counter()
        for row in listed.exclude(sizes=[]).values_list("sizes", flat=True):
            tally.update(row)
        sizes = [
            {"value": size, "label": size, "count": count}
            for size, count in tally.most_common(FACET_LIMIT)
        ]

        span = listed.aggregate(low=Min("price"), high=Max("price"))

        return Response({
            "audiences": audiences,
            "slots": slots,
            "categories": categories,
            "shops": shops,
            "colors": colors,
            "sizes": sizes,
            "price_floor": int(span["low"] or 0),
            "price_ceiling": int(span["high"] or 0),
        })


def _slot_label(slot: str) -> str:
    try:
        return Category.Slot(slot).label
    except ValueError:
        return slot
