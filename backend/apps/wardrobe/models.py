"""
Two columns here, warmth_level and is_waterproof, are stored on every garment
but nothing filters by them yet. The weather endpoint already works out which
warmth levels suit today; matching clothes to that is the next step. They were
added early because adding columns to a table that already holds real clothes
is slow and risky.
"""

from __future__ import annotations

from decimal import Decimal

from django.conf import settings
from django.contrib.postgres.fields import ArrayField
from django.contrib.postgres.indexes import GinIndex
from django.core.exceptions import ValidationError
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import IntegrityError, models, transaction
from django.db.models.functions import Coalesce
from django.utils import timezone


class StorageLocation(models.Model):
    """
    One real place where clothes are kept, which may sit inside another place.
    Example: Bedroom > Main Wardrobe > Drawer 2.

    Each row simply points at its parent, so one table holds every level.
    Closets are shallow, three or four levels at most, so walking up the chain
    is cheap.
    """

    class Kind(models.TextChoices):
        ROOM = "ROOM", "Room"
        WARDROBE = "WARDROBE", "Wardrobe / Closet"
        CABINET = "CABINET", "Cabinet"
        DRAWER = "DRAWER", "Drawer"
        SHELF = "SHELF", "Shelf"
        RAIL = "RAIL", "Hanging rail"
        HANGER = "HANGER", "Hanger slot"
        BOX = "BOX", "Box / Storage bin"
        SUITCASE = "SUITCASE", "Suitcase"
        OTHER = "OTHER", "Other"

    MAX_DEPTH = 4  # Room > Wardrobe > Drawer > Slot

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="storage_locations",
    )
    name = models.CharField(max_length=80, help_text="e.g. 'Main Wardrobe' or 'Drawer 2'")
    kind = models.CharField(max_length=20, choices=Kind.choices, default=Kind.OTHER)

    parent = models.ForeignKey(
        "self",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="children",
    )

    notes = models.CharField(max_length=200, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "storage_locations"
        ordering = ["name"]
        constraints = [
            # Names must be unique inside the same parent, not across the whole
            # account. Two wardrobes may each have a "Drawer 2", but one
            # wardrobe cannot have two.
            models.UniqueConstraint(
                fields=["owner", "parent", "name"],
                name="unique_location_name_per_parent",
            ),
            # Postgres treats two empty parents as different values, so the
            # rule above never applies to a top-level place such as a room.
            # This second rule stops two rooms sharing a name.
            models.UniqueConstraint(
                fields=["owner", "name"],
                condition=models.Q(parent__isnull=True),
                name="unique_root_location_name_per_owner",
            ),
        ]
        indexes = [models.Index(fields=["owner", "parent"])]

    def __str__(self):
        return self.full_path

    def clean(self):
        if not self.parent_id:
            return

        if self.parent_id == self.pk:
            raise ValidationError({"parent": "A location cannot be inside itself."})

        chain = []
        ancestor = self.parent
        while ancestor is not None:
            if ancestor.pk == self.pk:
                raise ValidationError(
                    {"parent": "That would create a loop - this is already a parent of it."}
                )
            chain.append(ancestor)
            ancestor = ancestor.parent

        if self.parent.owner_id != self.owner_id:
            raise ValidationError({"parent": "That location belongs to someone else."})

        # len(chain) is how deep this place would sit, and whatever is already
        # nested inside it moves down with it. Example: moving a wardrobe full
        # of drawers into a cabinet pushes the drawers one level deeper, so the
        # check has to count them too.
        if len(chain) + self.height > self.MAX_DEPTH - 1:
            raise ValidationError(
                {"parent": f"Storage can only be nested {self.MAX_DEPTH} levels deep."}
            )

    @property
    def ancestors(self) -> list[StorageLocation]:
        """Outermost first. For Drawer 2 this is [Bedroom, Main Wardrobe]."""
        chain: list[StorageLocation] = []
        node = self.parent
        while node is not None:
            chain.append(node)
            node = node.parent
        return list(reversed(chain))

    @property
    def full_path(self) -> str:
        return " > ".join([*(a.name for a in self.ancestors), self.name])

    @property
    def depth(self) -> int:
        return len(self.ancestors)

    @property
    def height(self) -> int:
        """How many levels are nested inside this one. An empty drawer is 0."""
        # A row that has not been saved yet has no id. Asking for its children
        # would then match every place with no parent instead of nothing.
        if not self.pk:
            return 0
        children = list(self.children.all())
        return 1 + max((child.height for child in children), default=0) if children else 0

    def descendant_ids(self) -> list[int]:
        """This location plus every location nested inside it, at any depth."""
        ids = [self.pk]
        stack = list(self.children.all())
        while stack:
            node = stack.pop()
            ids.append(node.pk)
            stack.extend(node.children.all())
        return ids


class Category(models.Model):
    """
    A kind of clothing, such as "Shirt" or "Kurta".

    The slot is what matters when building an outfit, not the name. A complete
    outfit needs one TOP, one BOTTOM and one FOOTWEAR, whatever those happen to
    be called.

    A category with no owner is built in and shared by everyone. One with an
    owner was added by that person and is theirs alone.
    """

    class Slot(models.TextChoices):
        TOP = "TOP", "Top"
        BOTTOM = "BOTTOM", "Bottom"
        FULL_BODY = "FULL_BODY", "Full body"  # dress or kurta, fills TOP and BOTTOM at once
        OUTERWEAR = "OUTERWEAR", "Outerwear"
        FOOTWEAR = "FOOTWEAR", "Footwear"
        ACCESSORY = "ACCESSORY", "Accessory"
        HEADWEAR = "HEADWEAR", "Headwear"
        OTHER = "OTHER", "Other"

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="custom_categories",
        help_text="Empty means this is a built-in category shared by everyone.",
    )
    name = models.CharField(max_length=60)
    slot = models.CharField(max_length=20, choices=Slot.choices, default=Slot.OTHER)
    icon = models.CharField(max_length=40, blank=True, help_text="lucide-react icon name")
    sort_order = models.PositiveSmallIntegerField(default=100)

    class Meta:
        db_table = "categories"
        ordering = ["sort_order", "name"]
        verbose_name_plural = "categories"
        constraints = [
            models.UniqueConstraint(fields=["owner", "name"], name="unique_category_per_owner"),
        ]

    def __str__(self):
        return self.name

    @property
    def is_system(self) -> bool:
        return self.owner_id is None


class GarmentItemQuerySet(models.QuerySet):
    def with_last_occasion(self):
        """
        Adds the note from the most recent wearing to each item, so a list can
        say "worn to Ayesha's mehndi" without asking the database once per row.
        """
        latest = WearEvent.objects.filter(item_id=models.OuterRef("pk")).order_by("-worn_on")
        return self.annotate(
            last_worn_note=Coalesce(models.Subquery(latest.values("note")[:1]), models.Value(""))
        )


class GarmentItem(models.Model):
    class Status(models.TextChoices):
        IN_WARDROBE = "IN_WARDROBE", "In wardrobe"
        IN_LAUNDRY = "IN_LAUNDRY", "In the wash"
        LENT_OUT = "LENT_OUT", "Lent to a friend"
        FOR_SALE = "FOR_SALE", "Listed for sale"
        SOLD = "SOLD", "Sold"
        # Called "Put away" everywhere on screen. The code says ARCHIVED, but
        # the person never sees that word.
        ARCHIVED = "ARCHIVED", "Put away"

    WEARABLE_STATUSES = [Status.IN_WARDROBE]

    # Not available right now: sold, put away, or out with a friend. A lent
    # item is still owned, so it is not in GONE_STATUSES, but it cannot be worn
    # or sold until it comes back.
    AWAY_STATUSES = [Status.SOLD, Status.ARCHIVED, Status.LENT_OUT]

    # Things the person no longer has. The rows stay so a sale keeps its
    # history and the wear log has no holes, but they are not part of the
    # wardrobe any more. Every count and list leaves them out unless asked for
    # them by name.
    GONE_STATUSES = [Status.SOLD, Status.ARCHIVED]

    class Season(models.TextChoices):
        SUMMER = "SUMMER", "Summer"
        WINTER = "WINTER", "Winter"
        SPRING = "SPRING", "Spring"
        AUTUMN = "AUTUMN", "Autumn"

    class Occasion(models.TextChoices):
        CASUAL = "CASUAL", "Casual"
        FORMAL = "FORMAL", "Formal"
        BUSINESS = "BUSINESS", "Business"
        PARTY = "PARTY", "Party"
        TRADITIONAL = "TRADITIONAL", "Traditional"
        SPORT = "SPORT", "Sport"
        LOUNGE = "LOUNGE", "Loungewear"

    class Pattern(models.TextChoices):
        SOLID = "SOLID", "Solid"
        STRIPED = "STRIPED", "Striped"
        CHECKED = "CHECKED", "Checked"
        PRINTED = "PRINTED", "Printed"
        FLORAL = "FLORAL", "Floral"
        OTHER = "OTHER", "Other"

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="garments",
    )

    name = models.CharField(max_length=120, help_text="e.g. 'Navy linen shirt'")
    category = models.ForeignKey(
        Category,
        on_delete=models.PROTECT,
        related_name="items",
    )
    brand = models.CharField(max_length=60, blank=True)
    size = models.CharField(max_length=20, blank=True)
    material = models.CharField(max_length=60, blank=True)
    pattern = models.CharField(max_length=20, choices=Pattern.choices, default=Pattern.SOLID)

    primary_color_hex = models.CharField(
        max_length=7, blank=True, help_text="#1a2b3c - detected from the photo"
    )
    primary_color_name = models.CharField(max_length=30, blank=True, help_text="e.g. 'Navy'")
    secondary_color_hex = models.CharField(max_length=7, blank=True)

    seasons = ArrayField(
        models.CharField(max_length=10, choices=Season.choices),
        default=list,
        blank=True,
        help_text="Empty means suitable all year.",
    )
    occasions = ArrayField(
        models.CharField(max_length=15, choices=Occasion.choices),
        default=list,
        blank=True,
    )
    warmth_level = models.PositiveSmallIntegerField(
        default=3,
        validators=[MinValueValidator(1), MaxValueValidator(5)],
        help_text="1 = very light (vest), 5 = very warm (winter coat). Matched against temperature.",
    )
    is_waterproof = models.BooleanField(default=False, help_text="Considered when rain is forecast.")

    storage_location = models.ForeignKey(
        StorageLocation,
        on_delete=models.SET_NULL,   # deleting a drawer must not delete the clothes in it
        null=True,
        blank=True,
        related_name="items",
    )

    # Cloudinary deletes a picture by its public id, and that id cannot be
    # worked out from the web address, so both are saved for each picture.
    original_image_url = models.URLField(max_length=500, blank=True)
    original_image_public_id = models.CharField(max_length=200, blank=True)
    clean_image_url = models.URLField(
        max_length=500, blank=True, help_text="Background removed by rembg."
    )
    clean_image_public_id = models.CharField(max_length=200, blank=True)

    status = models.CharField(max_length=20, choices=Status.choices, default=Status.IN_WARDROBE)

    # Read by the friends app. When this is off, a friend never sees the item,
    # even if the rest of the closet is shared.
    is_lendable = models.BooleanField(
        default=True,
        help_text="Off means friends never see this one, even when your closet is shared.",
    )
    is_favorite = models.BooleanField(default=False)

    purchase_price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        # cost_per_wear divides the price by the wear count. A negative price
        # would show the owner a negative cost.
        validators=[MinValueValidator(Decimal("0"))],
    )
    currency = models.CharField(max_length=3, default="PKR")
    purchase_date = models.DateField(null=True, blank=True)

    # Stored here as well as in the wear log. The closet grid shows both
    # numbers for every item on screen, and counting them from the log each
    # time cost one extra database query per item, around 40 per page.
    wear_count = models.PositiveIntegerField(default=0)
    last_worn_date = models.DateField(null=True, blank=True)

    notes = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = GarmentItemQuerySet.as_manager()

    class Meta:
        db_table = "garment_items"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["owner", "status"]),
            models.Index(fields=["owner", "category"]),
            models.Index(fields=["owner", "last_worn_date"]),
            models.Index(fields=["owner", "storage_location"]),
            # The closet list shows newest first. This index serves the owner
            # filter and the sort together, so Postgres never sorts the whole
            # table.
            models.Index(fields=["owner", "-created_at"], name="garment_owner_recent"),
            # seasons and occasions are lists, matched with "contains". An
            # ordinary index cannot answer that question; a GIN index lists
            # each entry inside the array.
            GinIndex(fields=["seasons"], name="garment_seasons_gin"),
            GinIndex(fields=["occasions"], name="garment_occasions_gin"),
            # Used by the misspelling fallback in SpellingTolerantSearch.
            # Without these, a typo search would have to score every row in
            # the table.
            GinIndex(fields=["name"], name="garment_name_trgm", opclasses=["gin_trgm_ops"]),
            GinIndex(fields=["brand"], name="garment_brand_trgm", opclasses=["gin_trgm_ops"]),
        ]

    def __str__(self):
        return f"{self.name} ({self.owner.email})"

    @property
    def display_image_url(self) -> str:
        return self.clean_image_url or self.original_image_url

    @property
    def cost_per_wear(self) -> float | None:
        """
        Price divided by the number of times worn. Example: a 4,000 rupee kurta
        worn 8 times costs 500 per wear. Nothing when no price was recorded,
        and the full price while it has never been worn.
        """
        if self.purchase_price is None:
            return None
        if self.wear_count == 0:
            return float(self.purchase_price)
        return round(float(self.purchase_price) / self.wear_count, 2)

    @property
    def days_since_worn(self) -> int | None:
        if self.last_worn_date is None:
            return None
        return (timezone.localdate() - self.last_worn_date).days

    @property
    def is_wearable_now(self) -> bool:
        return self.status in self.WEARABLE_STATUSES

    @property
    def location_path(self) -> str:
        return self.storage_location.full_path if self.storage_location else ""

    def mark_worn(self, on_date=None, note: str = "") -> tuple[WearEvent, bool]:
        """
        Records a wearing and returns the row plus whether it was new.

        Wearing the same thing twice on one day counts as one wearing. A double
        tap on the button is far more likely than a real second wear, and
        every extra tap would quietly halve the cost per wear.
        """
        day = on_date or timezone.localdate()
        try:
            with transaction.atomic():
                event = WearEvent.objects.create(owner_id=self.owner_id, item=self, worn_on=day, note=note)
        except IntegrityError:
            # Two taps landed at the same moment. The database rule decides
            # which one won.
            return WearEvent.objects.get(item=self, worn_on=day), False

        self.resync_wear_totals()
        return event, True

    def forget_wear(self, on_date=None) -> bool:
        """Undoes a wearing. Returns whether there was one to undo."""
        day = on_date or timezone.localdate()
        removed, _ = WearEvent.objects.filter(item=self, worn_on=day).delete()
        if removed:
            self.resync_wear_totals()
        return bool(removed)

    def resync_wear_totals(self) -> None:
        """
        Recounts the two summary columns from the wear log in one database
        statement. Reading them into Python first and writing them back would
        let two requests arriving together save the same number and lose a
        wearing.
        """
        log = WearEvent.objects.filter(item_id=models.OuterRef("pk"))
        GarmentItem.objects.filter(pk=self.pk).update(
            wear_count=Coalesce(
                models.Subquery(
                    log.values("item_id").annotate(n=models.Count("id")).values("n")[:1]
                ),
                0,
            ),
            last_worn_date=models.Subquery(log.order_by("-worn_on").values("worn_on")[:1]),
            updated_at=timezone.now(),
        )
        self.refresh_from_db(fields=["wear_count", "last_worn_date", "updated_at"])


class WearEvent(models.Model):
    """
    One day on which an item was worn.

    GarmentItem.wear_count and last_worn_date are kept in step with this table
    instead of being counted from it every time. The closet grid shows both for
    every item on screen, which would otherwise be one count per item.
    """

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="wear_events",
    )
    item = models.ForeignKey(GarmentItem, on_delete=models.CASCADE, related_name="wears")
    worn_on = models.DateField()
    note = models.CharField(max_length=200, blank=True, help_text="e.g. 'Ayesha's mehndi'")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "wear_events"
        ordering = ["-worn_on", "-created_at"]
        constraints = [
            # One wearing per item per day. Without this, a repeated tap counts
            # twice and the cost per wear reads lower than it really is.
            models.UniqueConstraint(fields=["item", "worn_on"], name="one_wear_per_item_per_day"),
        ]
        indexes = [
            # "What did I wear this week" and the home page feed both read this
            # newest first for one person.
            models.Index(fields=["owner", "-worn_on"], name="wear_owner_recent"),
        ]

    def __str__(self):
        return f"{self.item.name} on {self.worn_on}"

    def clean(self):
        if self.worn_on and self.worn_on > timezone.localdate():
            raise ValidationError({"worn_on": "That day has not happened yet."})
        if self.item_id and self.owner_id and self.item.owner_id != self.owner_id:
            raise ValidationError({"item": "That item belongs to someone else."})
