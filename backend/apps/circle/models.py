"""
A name search cannot tell a real person from somebody using their name, so
friendships start from a private code instead. The other half of that is the
rule that each person's nicknames for their friends must be unique: if Sara has
two friends called "Ali Khan", she has to call one of them something else, so
her list never shows the same words twice.
"""

from __future__ import annotations

from django.conf import settings
from django.db import models, transaction
from django.utils import timezone

from apps.community.models import refuse_contact_details
from apps.wardrobe.models import GarmentItem


class FriendRequest(models.Model):
    """Nothing is shared between the two accounts until this is accepted."""

    class Status(models.TextChoices):
        SENT = "SENT", "Waiting for an answer"
        ACCEPTED = "ACCEPTED", "Accepted"
        DECLINED = "DECLINED", "Declined"

    from_user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="friend_requests_sent"
    )
    to_user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="friend_requests_received"
    )
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.SENT)
    created_at = models.DateTimeField(auto_now_add=True)
    answered_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "friend_requests"
        ordering = ["-created_at"]
        constraints = [
            # Only one unanswered request per pair at a time. Once a request is
            # declined it no longer counts, so asking again later is allowed.
            models.UniqueConstraint(
                fields=["from_user", "to_user"],
                condition=models.Q(status="SENT"),
                name="one_pending_request_per_pair",
            ),
            models.CheckConstraint(
                condition=~models.Q(from_user=models.F("to_user")),
                name="nobody_befriends_themselves",
            ),
        ]

    def __str__(self):
        return f"{self.from_user_id} -> {self.to_user_id} ({self.status})"


class Friend(models.Model):
    """
    One direction of a friendship. Accepting a request writes two rows, one for
    each side, so each person keeps their own nickname for the other and their
    own block switch, and neither can read the other's.
    """

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="friends"
    )
    person = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="known_by"
    )
    nickname = models.CharField(
        max_length=60,
        help_text="What you call them. Only you ever see it.",
    )
    blocked = models.BooleanField(
        default=False,
        help_text="Hides everything both ways without losing who has what.",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "friends"
        ordering = ["nickname"]
        constraints = [
            models.UniqueConstraint(fields=["owner", "person"], name="one_row_per_friend"),
            models.UniqueConstraint(fields=["owner", "nickname"], name="one_name_per_friend"),
        ]

    def __str__(self):
        return f"{self.owner_id}: {self.nickname}"


class Loan(models.Model):
    """
    The garment never changes owner. Only its status moves to LENT_OUT, which
    keeps it inside the lender's totals while stopping it being worn, washed,
    planned or sold for as long as the loan is open.
    """

    class Status(models.TextChoices):
        ASKED = "ASKED", "Waiting for an answer"
        AGREED = "AGREED", "Lent out"
        RETURNED = "RETURNED", "Given back"
        DECLINED = "DECLINED", "Declined"
        CANCELLED = "CANCELLED", "Cancelled"

    OPEN_STATUSES = [Status.ASKED, Status.AGREED]

    item = models.ForeignKey(GarmentItem, on_delete=models.CASCADE, related_name="loans")
    lender = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="lent_out"
    )
    borrower = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="borrowed"
    )
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.ASKED)

    borrow_from = models.DateField(help_text="The day they want it.")
    borrow_until = models.DateField(help_text="The day they will give it back.")
    message = models.TextField(blank=True, max_length=500)

    created_at = models.DateTimeField(auto_now_add=True)
    answered_at = models.DateTimeField(null=True, blank=True)
    returned_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "loans"
        ordering = ["-created_at"]
        constraints = [
            # One open loan per garment. Without this, two overlapping requests
            # could both be agreed to and two people promised the same kurta.
            models.UniqueConstraint(
                fields=["item"],
                condition=models.Q(status__in=["ASKED", "AGREED"]),
                name="one_open_loan_per_item",
            ),
            models.CheckConstraint(
                condition=models.Q(borrow_until__gte=models.F("borrow_from")),
                name="giving_it_back_is_not_before_getting_it",
            ),
            models.CheckConstraint(
                condition=~models.Q(lender=models.F("borrower")),
                name="nobody_borrows_from_themselves",
            ),
        ]

    def __str__(self):
        return f"{self.item_id} to {self.borrower_id} ({self.status})"

    def clean(self):
        refuse_contact_details(self.message)

    @property
    def is_overdue(self) -> bool:
        return self.status == self.Status.AGREED and self.borrow_until < timezone.localdate()

    @property
    def days_late(self) -> int:
        return max(0, (timezone.localdate() - self.borrow_until).days) if self.is_overdue else 0

    @transaction.atomic
    def agree(self) -> None:
        self.status = self.Status.AGREED
        self.answered_at = timezone.now()
        self.save(update_fields=["status", "answered_at"])
        GarmentItem.objects.filter(pk=self.item_id).update(
            status=GarmentItem.Status.LENT_OUT, updated_at=timezone.now()
        )

    @transaction.atomic
    def give_back(self) -> None:
        self.status = self.Status.RETURNED
        self.returned_at = timezone.now()
        self.save(update_fields=["status", "returned_at"])
        GarmentItem.objects.filter(pk=self.item_id).update(
            status=GarmentItem.Status.IN_WARDROBE, updated_at=timezone.now()
        )
