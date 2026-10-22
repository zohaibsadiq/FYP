"""
A try-on is a generated picture of one person wearing one garment. The body
photo, the garment and the result are all personal, so nothing here is ever
sent to another account.
"""

from __future__ import annotations

from django.conf import settings
from django.db import models
from django.utils import timezone

from apps.wardrobe.models import GarmentItem


class TryOnQuerySet(models.QuerySet):
    def made_today(self, user):
        return self.filter(owner=user, created_at__date=timezone.localdate())


class TryOn(models.Model):
    class Status(models.TextChoices):
        PENDING = "PENDING", "Working on it"
        READY = "READY", "Ready"
        FAILED = "FAILED", "Did not work"

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="try_ons"
    )
    # Empty for a garment uploaded straight into Try-On and never kept, and
    # for one that was kept and later deleted. The picture is of a person, so
    # it outlives whatever it was made from.
    item = models.ForeignKey(
        GarmentItem, on_delete=models.SET_NULL, null=True, blank=True, related_name="try_ons"
    )

    # A copy of what was sent, taken at the time. The garment can be renamed,
    # re-photographed or deleted later without changing this picture's story.
    garment_name = models.CharField(max_length=120, default="")
    garment_image_url = models.URLField(default="")
    garment_slot = models.CharField(max_length=20, default="")
    garment_public_id = models.CharField(max_length=255, blank=True)

    # The body photo in use when this was made. Replacing the photo later must
    # not make an old result look as though it came from the new one.
    body_photo_url = models.URLField()

    result_url = models.URLField(blank=True)
    result_public_id = models.CharField(max_length=255, blank=True)

    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    # The supplier queues the work and answers minutes later. This id is how
    # the row finds its job again on their side.
    provider_task_id = models.CharField(max_length=120, blank=True)
    # Shown to the owner, so it holds a plain sentence rather than a technical
    # error.
    error = models.CharField(max_length=300, blank=True)
    provider = models.CharField(max_length=60, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    objects = TryOnQuerySet.as_manager()

    class Meta:
        db_table = "try_ons"
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["owner", "-created_at"])]

    def __str__(self):
        return f"{self.owner_id} wearing {self.garment_name} ({self.status})"

    @property
    def is_waiting(self) -> bool:
        return self.status == self.Status.PENDING and bool(self.provider_task_id)

    def queued(self, task_id: str, provider: str) -> None:
        self.provider_task_id = task_id
        self.provider = provider
        self.save(update_fields=["provider_task_id", "provider"])

    def succeeded(self, url: str, public_id: str, provider: str) -> None:
        self.result_url = url
        self.result_public_id = public_id
        self.provider = provider
        self.status = self.Status.READY
        self.completed_at = timezone.now()
        self.save(update_fields=["result_url", "result_public_id", "provider", "status", "completed_at"])

    def failed(self, reason: str) -> None:
        self.error = reason[:300]
        self.status = self.Status.FAILED
        self.completed_at = timezone.now()
        self.save(update_fields=["error", "status", "completed_at"])
