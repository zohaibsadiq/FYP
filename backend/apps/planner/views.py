"""What today looks like outside, and what in the closet suits it."""

from __future__ import annotations

from django.db.models import Case, Q, When
from drf_spectacular.utils import extend_schema
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.wardrobe.models import Category, GarmentItem
from apps.wardrobe.serializers import GarmentItemListSerializer

from .serializers import TodaySerializer
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
