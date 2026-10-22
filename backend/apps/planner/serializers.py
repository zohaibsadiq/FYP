from __future__ import annotations

from django.utils import timezone
from rest_framework import serializers

from apps.wardrobe.models import GarmentItem
from apps.wardrobe.serializers import GarmentItemListSerializer

from .models import PlannedOutfit


class AdviceSerializer(serializers.Serializer):
    headline = serializers.CharField(help_text="A word or two: Mild, Warm, Very hot.")
    wear = serializers.CharField(help_text="A sentence the screen can show unchanged.")
    warmth_levels = serializers.ListField(
        child=serializers.IntegerField(min_value=1, max_value=5),
        help_text="The warmth_level values on a garment that suit today.",
    )
    season = serializers.ChoiceField(choices=["SUMMER", "WINTER", "SPRING", "AUTUMN"])
    take_umbrella = serializers.BooleanField()


class WeatherSerializer(serializers.Serializer):
    city = serializers.CharField()
    country = serializers.CharField()
    temp_c = serializers.IntegerField()
    feels_like_c = serializers.IntegerField()
    high_c = serializers.IntegerField()
    low_c = serializers.IntegerField()
    humidity = serializers.IntegerField()
    wind_kph = serializers.IntegerField()
    condition = serializers.CharField(help_text="Clear, Clouds, Rain, and so on.")
    description = serializers.CharField()
    icon = serializers.CharField()
    is_day = serializers.BooleanField()
    rain_chance = serializers.IntegerField(help_text="Percent, over the next day.")
    advice = AdviceSerializer()


class UnavailableSerializer(serializers.Serializer):
    code = serializers.CharField(help_text="no_city, unknown_city, not_configured, timeout.")
    reason = serializers.CharField(help_text="Already written for the reader.")


class TodaySerializer(serializers.Serializer):
    """Either weather is filled in or unavailable is, never both."""

    weather = WeatherSerializer(allow_null=True)
    unavailable = UnavailableSerializer(allow_null=True)


class PlannedOutfitSerializer(serializers.ModelSerializer):
    """A day in the calendar, with enough of each item to draw it."""

    items = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=GarmentItem.objects.none(),   # replaced with the person's own clothes in __init__
        required=False,
    )
    item_details = GarmentItemListSerializer(source="items", many=True, read_only=True)
    is_confirmed = serializers.BooleanField(read_only=True)
    days_away = serializers.IntegerField(read_only=True)

    class Meta:
        model = PlannedOutfit
        fields = [
            "id", "planned_for", "label", "note",
            "items", "item_details",
            "is_confirmed", "worn_confirmed_at", "days_away",
            "created_at", "updated_at",
        ]
        read_only_fields = ["id", "worn_confirmed_at", "created_at", "updated_at"]
        # The automatic check would name database columns at the person.
        # validate_planned_for says the same thing in plain words instead.
        validators = []

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            self.fields["items"].child_relation.queryset = GarmentItem.objects.filter(
                owner=request.user
            )

    def validate_items(self, value):
        if len(value) > PlannedOutfit.MAX_ITEMS:
            raise serializers.ValidationError(
                f"A day can hold up to {PlannedOutfit.MAX_ITEMS} things."
            )

        # A plan is for clothes the person still has. Naming the item is more
        # helpful than a bare "invalid" when the reason is that they sold it
        # last week.
        gone = [i for i in value if i.status in GarmentItem.GONE_STATUSES]
        if gone:
            names = ", ".join(i.name for i in gone)
            raise serializers.ValidationError(
                f"{names} is not in your closet any more, so it cannot be planned."
                if len(gone) == 1
                else f"{names} are not in your closet any more, so they cannot be planned."
            )
        if len({item.id for item in value}) != len(value):
            raise serializers.ValidationError("The same thing is listed twice.")
        return value

    def validate_planned_for(self, value):
        floor = timezone.localdate() - timezone.timedelta(days=365)
        if value < floor:
            raise serializers.ValidationError("That day is more than a year past.")

        owner = self.context["request"].user
        clash = PlannedOutfit.objects.filter(owner=owner, planned_for=value)
        if self.instance:
            clash = clash.exclude(pk=self.instance.pk)
        if clash.exists():
            raise serializers.ValidationError(
                "You already have a plan for that day. Open it and change it instead."
            )
        return value


class PlanDaySerializer(serializers.Serializer):
    """One square of the month grid."""

    date = serializers.DateField()
    label = serializers.CharField()
    item_count = serializers.IntegerField()
    is_confirmed = serializers.BooleanField()


class ConfirmWornSerializer(serializers.Serializer):
    recorded = serializers.IntegerField(help_text="How many items this added to the wear log.")
    plan = PlannedOutfitSerializer()
