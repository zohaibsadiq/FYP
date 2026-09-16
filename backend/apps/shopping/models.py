"""
Clothes for sale in real shops, kept as a copy of what those shops publish.

Nothing here is fetched while somebody is waiting. A refresh runs on its own
schedule, writes what it found into these tables, and the screen reads the
tables. That keeps the page fast, keeps a shop being down from breaking it,
and means every price can be shown with the moment it was checked.
"""

from __future__ import annotations

from decimal import Decimal

from django.contrib.postgres.fields import ArrayField
from django.db import models
from django.utils import timezone

from apps.wardrobe.models import Category


class Shop(models.Model):
    """One store whose public catalogue is read on a schedule."""

    class Feed(models.TextChoices):
        SHOPIFY = "SHOPIFY", "Shopify storefront feed"

    class Result(models.TextChoices):
        NEVER = "NEVER", "Not checked yet"
        OK = "OK", "Last check succeeded"
        FAILED = "FAILED", "Last check failed"

    name = models.CharField(max_length=80, unique=True)
    slug = models.SlugField(max_length=60, unique=True)
    site_url = models.URLField(help_text="Where a shopper lands, e.g. https://outfitters.com.pk")
    feed_url = models.URLField(help_text="The catalogue address, usually the site plus /products.json")
    feed_kind = models.CharField(max_length=20, choices=Feed.choices, default=Feed.SHOPIFY)
    currency = models.CharField(max_length=3, default="PKR")

    is_active = models.BooleanField(default=True)
    sort_order = models.PositiveSmallIntegerField(default=100)

    # Some shops ask for a gap between requests in their robots file. Honouring
    # it is the difference between reading a catalogue and hammering a server.
    request_gap_seconds = models.FloatField(
        default=1.0,
        help_text="Seconds to wait between pages. Raise it for a shop that asks for a crawl delay.",
    )
    max_pages = models.PositiveSmallIntegerField(
        default=8,
        help_text="Pages of 250 products to read at most, so one huge shop cannot run forever.",
    )

    last_checked_at = models.DateTimeField(null=True, blank=True)
    last_result = models.CharField(max_length=10, choices=Result.choices, default=Result.NEVER)
    last_message = models.CharField(max_length=300, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "shops"
        ordering = ["sort_order", "name"]

    def __str__(self):
        return self.name

    def product_url(self, handle: str) -> str:
        return f"{self.site_url.rstrip('/')}/products/{handle}"

    def record_success(self, message: str = "") -> None:
        self.last_checked_at = timezone.now()
        self.last_result = self.Result.OK
        self.last_message = message[:300]
        self.save(update_fields=["last_checked_at", "last_result", "last_message"])

    def record_failure(self, message: str) -> None:
        # last_checked_at deliberately stays where it was. It answers "how old
        # is this price", and a failed attempt did not make any price newer.
        self.last_result = self.Result.FAILED
        self.last_message = message[:300]
        self.save(update_fields=["last_result", "last_message"])


class DealQuerySet(models.QuerySet):
    def listed(self):
        """Only things the shop still shows. Delisted rows are kept for history."""
        return self.filter(is_listed=True)

    def on_sale(self):
        return self.filter(discount_percent__gt=0)

    def dropped_since(self, when):
        return self.filter(price_fell_at__gte=when)


class Deal(models.Model):
    """
    One product in one shop, at the price last seen.

    A shop lists the same design in several sizes at the same price, so a row
    here is the product rather than the size: a grid of the same shirt five
    times is not a useful page. The sizes still in stock ride along.
    """

    shop = models.ForeignKey(Shop, on_delete=models.CASCADE, related_name="deals")

    # The shop's own id for the product. Paired with the shop it is unique, and
    # it survives the shop renaming the product.
    external_id = models.CharField(max_length=64)

    title = models.CharField(max_length=300)
    handle = models.CharField(max_length=300, blank=True)
    url = models.URLField(max_length=500)
    image_url = models.URLField(max_length=500, blank=True)
    vendor = models.CharField(max_length=120, blank=True)

    # What the shop calls this kind of thing, kept exactly as published so a
    # wrong guess further down can always be traced back.
    shop_category = models.CharField(max_length=120, blank=True)

    category = models.ForeignKey(
        Category,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="deals",
        help_text="Empty when the shop's wording did not match anything we stock.",
    )
    slot = models.CharField(
        max_length=20,
        choices=Category.Slot.choices,
        default=Category.Slot.OTHER,
        help_text="Where it is worn. Kept here as well so filtering works when the category is empty.",
    )

    color_name = models.CharField(max_length=40, blank=True)
    color_hex = models.CharField(max_length=7, blank=True)

    price = models.DecimalField(max_digits=10, decimal_places=2)
    was_price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="The price it was cut from. Empty when the shop is not calling it a sale.",
    )
    discount_percent = models.PositiveSmallIntegerField(default=0)

    sizes = ArrayField(models.CharField(max_length=40), default=list, blank=True)
    in_stock = models.BooleanField(default=True)

    is_listed = models.BooleanField(
        default=True,
        help_text="False once the shop stops publishing it. The row stays for the price history.",
    )

    first_seen_at = models.DateTimeField(auto_now_add=True)
    checked_at = models.DateTimeField(default=timezone.now)
    price_fell_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When the price was last seen to go down, which is what 'just dropped' reads.",
    )

    objects = DealQuerySet.as_manager()

    class Meta:
        db_table = "deals"
        ordering = ["-discount_percent", "price"]
        constraints = [
            models.UniqueConstraint(fields=["shop", "external_id"], name="one_row_per_shop_product"),
            models.CheckConstraint(condition=models.Q(price__gte=0), name="deal_price_not_negative"),
        ]
        indexes = [
            models.Index(fields=["is_listed", "-discount_percent"], name="deal_best_discount"),
            models.Index(fields=["is_listed", "price"], name="deal_cheapest"),
            models.Index(fields=["is_listed", "slot"], name="deal_by_slot"),
            models.Index(fields=["is_listed", "-price_fell_at"], name="deal_just_dropped"),
        ]

    def __str__(self):
        return f"{self.title} at {self.shop_id}"

    @property
    def saving(self) -> Decimal | None:
        if self.was_price is None or self.was_price <= self.price:
            return None
        return self.was_price - self.price


class PriceChange(models.Model):
    """
    A row is written only when a price actually moves.

    Writing one on every refresh would bury the few real changes under
    thousands of identical rows, and "it has not changed in a month" is worth
    being able to say.
    """

    deal = models.ForeignKey(Deal, on_delete=models.CASCADE, related_name="price_changes")
    price = models.DecimalField(max_digits=10, decimal_places=2)
    was_price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    noticed_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "deal_price_changes"
        ordering = ["-noticed_at"]
        indexes = [models.Index(fields=["deal", "-noticed_at"], name="price_change_recent")]

    def __str__(self):
        return f"{self.deal_id} to {self.price} on {self.noticed_at:%Y-%m-%d}"


class SyncRun(models.Model):
    """One attempt at refreshing one shop, kept so a run can be looked back on."""

    shop = models.ForeignKey(Shop, on_delete=models.CASCADE, related_name="runs")
    started_at = models.DateTimeField(default=timezone.now)
    finished_at = models.DateTimeField(null=True, blank=True)
    ok = models.BooleanField(default=False)

    found = models.PositiveIntegerField(default=0)
    added = models.PositiveIntegerField(default=0)
    updated = models.PositiveIntegerField(default=0)
    delisted = models.PositiveIntegerField(default=0)
    message = models.CharField(max_length=300, blank=True)

    class Meta:
        db_table = "deal_sync_runs"
        ordering = ["-started_at"]
        indexes = [models.Index(fields=["shop", "-started_at"], name="sync_run_recent")]

    def __str__(self):
        return f"{self.shop_id} on {self.started_at:%Y-%m-%d %H:%M}"

    @property
    def seconds_taken(self) -> float | None:
        if self.finished_at is None:
            return None
        return round((self.finished_at - self.started_at).total_seconds(), 1)
