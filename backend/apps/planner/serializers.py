"""Shapes for the weather reading and what it suggests wearing."""

from __future__ import annotations

from rest_framework import serializers

from apps.wardrobe.serializers import GarmentItemListSerializer


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


class PickSerializer(serializers.Serializer):
    slot = serializers.CharField()
    slot_label = serializers.CharField()
    items = GarmentItemListSerializer(many=True)


class TodaySerializer(serializers.Serializer):
    """Null weather and a filled `unavailable` both mean the same thing."""

    weather = WeatherSerializer(allow_null=True)
    unavailable = UnavailableSerializer(allow_null=True)
    picks = PickSerializer(many=True)
