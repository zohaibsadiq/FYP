"""Shapes for reading an outfit out of a photo and matching it to a closet."""

from __future__ import annotations

from rest_framework import serializers

from apps.wardrobe.models import Category
from apps.wardrobe.serializers import GarmentItemListSerializer


class LookUploadSerializer(serializers.Serializer):
    """The multipart body of POST /api/intelligence/look/."""

    image = serializers.ImageField(help_text="JPG, PNG or WebP. Maximum 12 MB.")


class MatchSerializer(serializers.Serializer):
    item = GarmentItemListSerializer()
    score = serializers.IntegerField(help_text="0 to 100, how close the colour is.")
    verdict = serializers.CharField(help_text="The same score in words.")


class LookPartSerializer(serializers.Serializer):
    """One part of the outfit, and what in the closet comes nearest to it."""

    slot = serializers.ChoiceField(
        choices=Category.Slot.choices,
        allow_blank=True,
        help_text="Blank when the photo held one garment rather than a whole outfit.",
    )
    slot_label = serializers.CharField()
    hex = serializers.CharField()
    color_name = serializers.CharField()
    matches = MatchSerializer(many=True)
    best_score = serializers.IntegerField()
    missing = serializers.BooleanField(
        help_text="True when the closet holds nothing for this part of the look."
    )


class LookResultSerializer(serializers.Serializer):
    parts = LookPartSerializer(many=True)
    how_close = serializers.IntegerField(
        help_text="0 to 100 across the whole look, averaged over its parts."
    )
    verdict = serializers.CharField()
    note = serializers.CharField(help_text="What to know about how the photo was read.")
    is_full_length = serializers.BooleanField()
    one_garment_only = serializers.BooleanField()
    code = serializers.CharField(
        help_text=(
            "Empty when the photo was read. Otherwise why it could not be: "
            "unreadable, too_small, no_subject, nothing_found."
        ),
    )
    preview = serializers.CharField(
        help_text="The photo as a small data URI, so the screen can show what was read. Nothing is stored."
    )
