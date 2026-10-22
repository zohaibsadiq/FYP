from __future__ import annotations

from django.db import IntegrityError, transaction
from django.db.models import Count, Prefetch
from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.wardrobe.models import GarmentItem

from .filters import PlannedOutfitFilter
from .models import PlannedOutfit
from .serializers import (
    ConfirmWornSerializer,
    PlanDaySerializer,
    PlannedOutfitSerializer,
    TodaySerializer,
)
from .weather import WeatherUnavailable, for_city


@extend_schema(
    tags=["Planner"],
    summary="Today's weather where this account lives",
    responses=TodaySerializer,
)
class TodayView(APIView):
    """
    When the weather cannot be fetched, the answer is still a success with a
    reason inside it, not an error. The home page draws around the gap, and a
    red error box for "no city saved yet" would be alarming for nothing.
    """

    def get(self, request):
        try:
            weather = for_city(request.user.city, request.user.country_code)
        except WeatherUnavailable as exc:
            return Response({
                "weather": None,
                "unavailable": {"code": exc.code, "reason": exc.reason},
            })

        return Response({"weather": weather.as_dict(), "unavailable": None})


@extend_schema(tags=["Planner"])
class PlannedOutfitViewSet(viewsets.ModelViewSet):
    """Days in the calendar, and the clothes set aside for them."""

    queryset = PlannedOutfit.objects.none()
    serializer_class = PlannedOutfitSerializer
    filterset_class = PlannedOutfitFilter
    ordering_fields = ["planned_for", "created_at"]
    ordering = ["-planned_for"]

    def get_queryset(self):
        return PlannedOutfit.objects.filter(owner=self.request.user).prefetch_related(
            # Loaded through the query that works out the "last worn" note.
            # Otherwise every item in every plan would cost one more database
            # query for that note.
            Prefetch(
                "items",
                queryset=GarmentItem.objects.with_last_occasion().select_related(
                    "category", "storage_location", "storage_location__parent"
                ),
            )
        )

    def perform_create(self, serializer):
        try:
            with transaction.atomic():
                serializer.save(owner=self.request.user)
        except IntegrityError as exc:
            # Two requests arriving at the same moment both pass the check in
            # the serializer, and the second one then hits the database rule.
            # It gets the same readable answer instead of a crash.
            raise ValidationError(
                {"planned_for": "You already have a plan for that day."}
            ) from exc

    @extend_schema(
        summary="Which days in a range have a plan",
        responses=PlanDaySerializer(many=True),
    )
    @action(detail=False, methods=["get"])
    def calendar(self, request):
        """One row per planned day, enough to draw a month grid without sending every plan's contents."""
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
        # Re-read so the items carry the "last worn" note just written, rather
        # than the one loaded before this call.
        return Response({
            "recorded": recorded,
            "plan": PlannedOutfitSerializer(
                self.get_queryset().get(pk=plan.pk), context={"request": request}
            ).data,
        })
