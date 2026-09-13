"""Today outside, what in the closet suits it, and the days ahead."""

from __future__ import annotations

from django.db import IntegrityError, transaction
from django.db.models import Case, Count, Q, When
from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.wardrobe.models import Category, GarmentItem
from apps.wardrobe.serializers import GarmentItemListSerializer

from .filters import PlannedOutfitFilter
from .models import PlannedOutfit
from .serializers import (
    ConfirmWornSerializer,
    PlanDaySerializer,
    PlannedOutfitSerializer,
    TodaySerializer,
)
from .weather import Weather, WeatherUnavailable, for_city

# Everything worn on an ordinary day. Outerwear is added only when it is cold
# enough or wet enough to need it, otherwise a jacket is suggested in July.
EVERYDAY = [Category.Slot.TOP, Category.Slot.BOTTOM, Category.Slot.FOOTWEAR]

PER_SLOT = 4


def suits_today(owner, weather: Weather):
    """
    Items that match today, one group per slot.

    Warmth is the strongest signal, so it filters. Season only narrows further
    when it leaves something: a closet where nothing is tagged for winter should
    still suggest the warmest things in it rather than nothing at all.
    """
    slots = list(EVERYDAY)
    if weather.advice.warmth_levels[-1] >= 4 or weather.advice.take_umbrella:
        slots.append(Category.Slot.OUTERWEAR)

    picks = []
    for slot in slots:
        base = GarmentItem.objects.filter(
            owner=owner,
            category__slot=slot,
            status__in=GarmentItem.WEARABLE_STATUSES,
        ).select_related("category", "storage_location", "storage_location__parent")

        warm_enough = base.filter(warmth_level__in=weather.advice.warmth_levels)
        if not warm_enough.exists():
            warm_enough = base

        in_season = warm_enough.filter(
            Q(seasons__contains=[weather.advice.season]) | Q(seasons=[])
        )
        if not in_season.exists():
            in_season = warm_enough

        picks.append({
            "slot": slot,
            "slot_label": Category.Slot(slot).label,
            "items": in_season.order_by(
                # Something that keeps the rain off comes first when rain is
                # forecast, and otherwise makes no difference to the order.
                Case(When(is_waterproof=weather.advice.take_umbrella, then=0), default=1),
                # Then whatever has waited longest, so the same shirt is not
                # suggested every single morning.
                "last_worn_date",
                "-is_favorite",
            )[:PER_SLOT],
        })

    return [group for group in picks if group["items"]]


@extend_schema(
    tags=["Planner"],
    summary="Today's weather and what in the closet suits it",
    responses=TodaySerializer,
)
class TodayView(APIView):
    """
    A failed weather lookup is answered with 200 and a reason rather than an
    error status: the dashboard draws around it, and a red error for a missing
    city would be misleading.
    """

    def get(self, request):
        try:
            weather = for_city(request.user.city, request.user.country_code)
        except WeatherUnavailable as exc:
            return Response({
                "weather": None,
                "unavailable": {"code": exc.code, "reason": exc.reason},
                "picks": [],
            })

        groups = suits_today(request.user, weather)
        return Response({
            "weather": weather.as_dict(),
            "unavailable": None,
            "picks": [
                {
                    "slot": group["slot"],
                    "slot_label": group["slot_label"],
                    "items": GarmentItemListSerializer(
                        group["items"], many=True, context={"request": request}
                    ).data,
                }
                for group in groups
            ],
        })


@extend_schema(tags=["Planner"])
class PlannedOutfitViewSet(viewsets.ModelViewSet):
    """Days in the calendar, and the clothes set aside for them."""

    queryset = PlannedOutfit.objects.none()
    serializer_class = PlannedOutfitSerializer
    filterset_class = PlannedOutfitFilter
    ordering_fields = ["planned_for", "created_at"]
    ordering = ["-planned_for"]

    def get_queryset(self):
        return (
            PlannedOutfit.objects.filter(owner=self.request.user)
            .prefetch_related("items__category", "items__storage_location")
        )

    def perform_create(self, serializer):
        try:
            with transaction.atomic():
                serializer.save(owner=self.request.user)
        except IntegrityError as exc:
            # Two requests arriving together both pass the check above and one
            # then meets the constraint, so it gets the same answer rather than
            # a 500.
            raise ValidationError(
                {"planned_for": "You already have a plan for that day."}
            ) from exc

    @extend_schema(
        summary="Which days in a range have a plan",
        responses=PlanDaySerializer(many=True),
    )
    @action(detail=False, methods=["get"])
    def calendar(self, request):
        """One row per planned day, for drawing a month without its contents."""
        plans = (
            self.filter_queryset(self.get_queryset())
            .annotate(items_in=Count("items"))
            .order_by("planned_for")
        )
        return Response([
            {
                "date": plan.planned_for,
                "label": plan.label,
                "item_count": plan.items_in,
                "is_confirmed": plan.is_confirmed,
            }
            for plan in plans
        ])

    @extend_schema(
        summary="Confirm the plan was actually worn, which fills in the wear log",
        request=None,
        responses=ConfirmWornSerializer,
    )
    @action(detail=True, methods=["post"], url_path="wore-it")
    def wore_it(self, request, pk=None):
        plan = self.get_object()
        if plan.planned_for > timezone.localdate():
            raise ValidationError(
                {"planned_for": "That day has not happened yet, so it cannot be confirmed."}
            )
        if not plan.items.exists():
            raise ValidationError(
                {"items": "There is nothing in this plan to record as worn."}
            )

        recorded = plan.confirm_worn()
        return Response({
            "recorded": recorded,
            "plan": PlannedOutfitSerializer(plan, context={"request": request}).data,
        })
