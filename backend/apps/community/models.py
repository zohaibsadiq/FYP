"""
Selling something out of your own wardrobe, and asking to buy somebody else's.

No money passes through this app. A buyer asks, a seller agrees, and the two
of them settle it between themselves the way people already do here. That
keeps card details out of the project entirely, and it is what everybody
already expects from a listings site.

The other rule is that nobody's contact details are published. A listing shows
the garment and the price. Only once a seller accepts a particular buyer do the
two of them see how to reach each other. That rule is only worth anything if
it cannot be walked around, so the note on a listing refuses to carry a phone
number or an email address.
"""

from __future__ import annotations

import re
from decimal import Decimal

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator
from django.db import models
from django.utils import timezone

from apps.wardrobe.models import GarmentItem

# What a thing is worth once it has been worn, as a share of what it cost new.
# These follow what resale sites and their sellers actually use. They are only
# ever offered as a suggestion; the seller types whatever they like.
RESALE_SHARE: dict[str, Decimal] = {
    "NEW": Decimal("0.80"),
    "LIKE_NEW": Decimal("0.55"),
    "GOOD": Decimal("0.40"),
    "WORN": Decimal("0.25"),
}

# A listing note is for describing the garment. Somebody putting their phone
# number in it would hand it to every stranger browsing, which is the exact
# thing the rest of this app is arranged to prevent.
LOOKS_LIKE_A_PHONE = re.compile(r"(?:\+?\d[\s\-().]*){9,}")
LOOKS_LIKE_AN_EMAIL = re.compile(r"[^\s@]+@[^\s@]+\.[^\s@]+")
LOOKS_LIKE_A_HANDLE = re.compile(r"(?i)\b(?:whats\s?app|wa\.me|insta(?:gram)?|snap(?:chat)?|telegram)\b")


def refuse_contact_details(text: str) -> None:
    """Raises when a free-text field is being used to publish a way to be reached."""
    if not text:
        return
    if LOOKS_LIKE_A_PHONE.search(text):
        raise ValidationError(
            "Leave your phone number out of this. It is shared automatically "
            "with a buyer once you accept them."
        )
    if LOOKS_LIKE_AN_EMAIL.search(text):
        raise ValidationError(
            "Leave your email out of this. It is shared automatically with a "
            "buyer once you accept them."
        )
    if LOOKS_LIKE_A_HANDLE.search(text):
        raise ValidationError(
            "Leave contact details out of this. They are shared automatically "
            "with a buyer once you accept them."
        )


class ListingQuerySet(models.QuerySet):
    def open(self):
        """Still for sale. Sold and withdrawn rows stay for the seller's history."""
        return self.filter(status=Listing.Status.ACTIVE)

    def visible_to(self, user):
        """
        What one person can browse.

        Their own things are left out, because seeing your own shirt among the
        things you could buy is confusing and it already sits under your
        listings. So is anything from somebody either of them has blocked.
        """
        blocked_by_me = Block.objects.filter(blocker=user).values("blocked_id")
        blocked_me = Block.objects.filter(blocked=user).values("blocker_id")
        return (
            self.open()
            .exclude(seller=user)
            .exclude(seller_id__in=blocked_by_me)
            .exclude(seller_id__in=blocked_me)
        )


class Listing(models.Model):
    """One garment offered for sale."""

    class Status(models.TextChoices):
        ACTIVE = "ACTIVE", "For sale"
        RESERVED = "RESERVED", "Held for a buyer"
        SOLD = "SOLD", "Sold"
        WITHDRAWN = "WITHDRAWN", "Taken down"

    class Audience(models.TextChoices):
        WOMEN = "WOMEN", "Women"
        MEN = "MEN", "Men"
        KIDS = "KIDS", "Kids"
        UNKNOWN = "UNKNOWN", "Not stated"

    class Condition(models.TextChoices):
        NEW = "NEW", "New with tags"
        LIKE_NEW = "LIKE_NEW", "Worn once or twice"
        GOOD = "GOOD", "Good, worn a few times"
        WORN = "WORN", "Well worn"

    OPEN_STATUSES = [Status.ACTIVE, Status.RESERVED]

    seller = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="listings",
    )
    item = models.ForeignKey(
        GarmentItem,
        on_delete=models.CASCADE,
        related_name="listings",
        help_text="The garment being sold. Its photo and details are what buyers see.",
    )

    asking_price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(0)],
    )
    currency = models.CharField(max_length=3, default="PKR")

    condition = models.CharField(max_length=10, choices=Condition.choices, default=Condition.GOOD)

    # Who it would suit. Starts from what the seller normally shops for,
    # because most people sell their own clothes, and is theirs to change,
    # because plenty of people are selling something of a relative's.
    audience = models.CharField(
        max_length=10,
        choices=Audience.choices,
        default=Audience.UNKNOWN,
    )

    note = models.CharField(
        max_length=300,
        blank=True,
        help_text="Anything a buyer should know about the garment. Not a place for contact details.",
    )

    # Taken from the seller's profile when the listing is made, and editable,
    # because somebody may be selling something they left at their parents'
    # house. Copied rather than read live so that moving city later does not
    # silently relocate every old listing, and so browsing by city is one
    # plain query.
    city = models.CharField(max_length=100, blank=True)

    status = models.CharField(max_length=10, choices=Status.choices, default=Status.ACTIVE)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    closed_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When it was sold or taken down.",
    )

    objects = ListingQuerySet.as_manager()

    class Meta:
        db_table = "listings"
        ordering = ["-created_at"]
        constraints = [
            # One live listing per garment. The condition is spelled out rather
            # than left to a plain unique constraint, which sold and withdrawn
            # rows would keep tripping over.
            models.UniqueConstraint(
                fields=["item"],
                condition=models.Q(status__in=["ACTIVE", "RESERVED"]),
                name="one_open_listing_per_item",
            ),
            models.CheckConstraint(
                condition=models.Q(asking_price__gte=0),
                name="asking_price_not_negative",
            ),
        ]
        indexes = [
            models.Index(fields=["status", "-created_at"], name="listing_open_newest"),
            models.Index(fields=["seller", "-created_at"], name="listing_by_seller"),
            models.Index(fields=["status", "asking_price"], name="listing_cheapest"),
            models.Index(fields=["status", "city"], name="listing_by_city"),
            models.Index(fields=["status", "audience"], name="listing_by_audience"),
        ]

    def __str__(self):
        return f"{self.item_id} at {self.asking_price}"

    def clean(self):
        if self.item_id and self.seller_id and self.item.owner_id != self.seller_id:
            raise ValidationError({"item": "You can only sell something of your own."})
        if self.note:
            try:
                refuse_contact_details(self.note)
            except ValidationError as exc:
                raise ValidationError({"note": exc.messages}) from exc

    @property
    def is_open(self) -> bool:
        return self.status in self.OPEN_STATUSES

    @staticmethod
    def suggest_price(item: GarmentItem, condition: str) -> Decimal | None:
        """
        What this might be worth now, from what it cost and how worn it is.

        None when nobody wrote down what they paid, because a made-up number
        is worse than no number.
        """
        if item.purchase_price is None:
            return None
        share = RESALE_SHARE.get(condition, RESALE_SHARE["GOOD"])
        return (Decimal(item.purchase_price) * share).quantize(Decimal("1"))

    def mark_sold(self) -> None:
        """
        Sold. The garment goes with it, so it stops showing in the closet as
        something to wear or to plan with.
        """
        self.status = self.Status.SOLD
        self.closed_at = timezone.now()
        self.save(update_fields=["status", "closed_at", "updated_at"])

        GarmentItem.objects.filter(pk=self.item_id).update(
            status=GarmentItem.Status.SOLD, updated_at=timezone.now()
        )
        self.enquiries.filter(status=Enquiry.Status.SENT).update(
            status=Enquiry.Status.CLOSED, answered_at=timezone.now()
        )

    def withdraw(self) -> None:
        """Taken down. The garment returns to the wardrobe as if nothing happened."""
        self.status = self.Status.WITHDRAWN
        self.closed_at = timezone.now()
        self.save(update_fields=["status", "closed_at", "updated_at"])

        GarmentItem.objects.filter(pk=self.item_id).update(
            status=GarmentItem.Status.IN_WARDROBE, updated_at=timezone.now()
        )
        self.enquiries.filter(status=Enquiry.Status.SENT).update(
            status=Enquiry.Status.CLOSED, answered_at=timezone.now()
        )


class Enquiry(models.Model):
    """
    One person asking to buy one listing.

    No contact details are stored here. They are added by the serializer, and
    only on an enquiry the seller has accepted, so nobody's number is handed
    out merely because they put a shirt up for sale.

    A buyer who changes their mind has the row removed rather than marked,
    because one request per person per listing is a rule and a withdrawn row
    would otherwise lock them out of ever asking again.
    """

    class Status(models.TextChoices):
        SENT = "SENT", "Waiting for the seller"
        ACCEPTED = "ACCEPTED", "Seller said yes"
        DECLINED = "DECLINED", "Seller said no"
        CLOSED = "CLOSED", "The listing ended"

    listing = models.ForeignKey(Listing, on_delete=models.CASCADE, related_name="enquiries")
    buyer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="enquiries",
    )

    message = models.CharField(
        max_length=300,
        blank=True,
        help_text="What the buyer wants to say. Optional, and not a place for contact details.",
    )
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.SENT)

    created_at = models.DateTimeField(auto_now_add=True)
    answered_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "listing_enquiries"
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["listing", "buyer"],
                name="one_enquiry_per_buyer_per_listing",
            ),
        ]
        indexes = [
            models.Index(fields=["buyer", "-created_at"], name="enquiry_by_buyer"),
            models.Index(fields=["listing", "status"], name="enquiry_by_listing"),
        ]

    def __str__(self):
        return f"{self.buyer_id} on {self.listing_id}"

    def clean(self):
        if self.listing_id and self.buyer_id and self.listing.seller_id == self.buyer_id:
            raise ValidationError({"listing": "You cannot ask to buy your own listing."})
        if self.message:
            try:
                refuse_contact_details(self.message)
            except ValidationError as exc:
                raise ValidationError({"message": exc.messages}) from exc

    @property
    def contact_is_shared(self) -> bool:
        """Only an accepted enquiry lets the two sides see each other."""
        return self.status == self.Status.ACCEPTED

    def accept(self) -> None:
        self.status = self.Status.ACCEPTED
        self.answered_at = timezone.now()
        self.save(update_fields=["status", "answered_at"])

        # Held rather than sold: the two still have to meet and agree. The
        # listing stops taking new askers while that happens.
        Listing.objects.filter(pk=self.listing_id).update(status=Listing.Status.RESERVED)

    def decline(self) -> None:
        self.status = self.Status.DECLINED
        self.answered_at = timezone.now()
        self.save(update_fields=["status", "answered_at"])

        # Back on sale, unless somebody else has already been accepted.
        still_held = self.listing.enquiries.filter(status=self.Status.ACCEPTED).exists()
        if not still_held:
            Listing.objects.filter(pk=self.listing_id, status=Listing.Status.RESERVED).update(
                status=Listing.Status.ACTIVE
            )


class Block(models.Model):
    """
    One person choosing not to deal with another.

    It cuts both ways on purpose. Blocking somebody hides their listings from
    you and yours from them, and stops either of you asking the other to buy
    anything. Somebody who has made a person uncomfortable should not be able
    to keep appearing in their app.
    """

    blocker = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="blocks_made",
    )
    blocked = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="blocks_received",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "marketplace_blocks"
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(fields=["blocker", "blocked"], name="one_block_per_pair"),
            models.CheckConstraint(
                condition=~models.Q(blocker=models.F("blocked")),
                name="cannot_block_yourself",
            ),
        ]

    def __str__(self):
        return f"{self.blocker_id} blocked {self.blocked_id}"


class Report(models.Model):
    """
    Somebody flagging a listing for a human to look at.

    Nothing is hidden automatically. A report that took a listing down on its
    own would be a way for one person to silence another, so this only records
    the complaint for an administrator to read.
    """

    class Reason(models.TextChoices):
        NOT_CLOTHING = "NOT_CLOTHING", "Not a piece of clothing"
        FAKE = "FAKE", "Looks fake or stolen"
        OFFENSIVE = "OFFENSIVE", "Offensive picture or wording"
        CONTACT = "CONTACT", "Trying to move the deal off the app"
        OTHER = "OTHER", "Something else"

    listing = models.ForeignKey(Listing, on_delete=models.CASCADE, related_name="reports")
    reporter = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="reports_made",
    )
    reason = models.CharField(max_length=20, choices=Reason.choices)
    note = models.CharField(max_length=300, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "listing_reports"
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["listing", "reporter"],
                name="one_report_per_person_per_listing",
            ),
        ]
        indexes = [models.Index(fields=["reviewed_at", "-created_at"], name="report_unreviewed")]

    def __str__(self):
        return f"{self.listing_id} reported by {self.reporter_id}"
