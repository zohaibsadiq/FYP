"""What someone intends to wear on a given day."""

from __future__ import annotations

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone

from apps.wardrobe.models import GarmentItem


class PlannedOutfit(models.Model):
    """
    One day, one set of clothes.

    Held to a single plan per day on purpose. A calendar where a square can
    hold two different answers has to explain which one it is showing, and
    the note covers the rare day that needs a change of clothes.
    """

    MAX_ITEMS = 12

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="planned_outfits",
    )
    planned_for = models.DateField()
    label = models.CharField(
        max_length=80,
        blank=True,
        help_text="What the day is, e.g. 'Ayesha's mehndi' or 'Job interview'.",
    )
    note = models.CharField(max_length=200, blank=True)

    items = models.ManyToManyField(GarmentItem, related_name="planned_in", blank=True)

    # Set when the plan is confirmed as actually worn, which writes the day
    # into the wear log. Kept so the calendar can show what was a plan and
    # what really happened.
    worn_confirmed_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "planned_outfits"
        ordering = ["-planned_for"]
        constraints = [
            models.UniqueConstraint(
                fields=["owner", "planned_for"],
                name="one_plan_per_day_per_owner",
            ),
        ]
        indexes = [models.Index(fields=["owner", "-planned_for"], name="plan_owner_recent")]

    def __str__(self):
        return f"{self.label or 'Plan'} on {self.planned_for}"

    def clean(self):
        if self.planned_for and self.planned_for < timezone.localdate() - timezone.timedelta(days=365):
            raise ValidationError({"planned_for": "That day is more than a year past."})

    @property
    def is_confirmed(self) -> bool:
        return self.worn_confirmed_at is not None

    @property
    def days_away(self) -> int:
        """Negative once the day has passed."""
        return (self.planned_for - timezone.localdate()).days

    def confirm_worn(self) -> int:
        """
        Writes every item in the plan into the wear log for that day and
        returns how many were newly recorded. Running it twice adds nothing,
        because a wearing is one per item per day.
        """
        recorded = 0
        for item in self.items.all():
            _, created = item.mark_worn(self.planned_for, self.label)
            recorded += int(created)

        self.worn_confirmed_at = timezone.now()
        self.save(update_fields=["worn_confirmed_at", "updated_at"])
        return recorded
