from __future__ import annotations

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone

from apps.wardrobe.models import GarmentItem


class PlannedOutfit(models.Model):
    """
    One day, one set of clothes.

    Only one plan per day, on purpose. A calendar square that could hold two
    different answers would have to explain which one it shows, and the note
    covers the rare day that needs a change of clothes.
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

    # Set when the person confirms they really wore the plan, which writes the
    # day into the wear log. Kept so the calendar can tell a plan from what
    # actually happened.
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
        returns how many were new. Running it twice adds nothing, because a
        wearing is counted once per item per day.

        A plan can outlive the clothes in it. Example: Ali plans a kurta for
        Friday, sells it on Thursday, then confirms the plan. The kurta is
        skipped, so nobody is ever recorded wearing something they no longer
        have.
        """
        recorded = 0
        for item in self.items.all():
            if item.status in GarmentItem.GONE_STATUSES:
                continue
            _, created = item.mark_worn(self.planned_for, self.label)
            recorded += int(created)

        self.worn_confirmed_at = timezone.now()
        self.save(update_fields=["worn_confirmed_at", "updated_at"])
        return recorded
