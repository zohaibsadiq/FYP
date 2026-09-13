"""
warmth_level and occasions are not read by any endpoint yet. They are defined
up front because the suggestion engine needs them, and adding columns to a
garment_items table that already holds real rows is expensive.
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
    One physical place, which may sit inside another place.

    Adjacency list: each row points at its parent, so a single table holds
    every level. Closet trees are shallow, three or four levels at most, so
    walking one recursively stays cheap.
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
            # Scoped to the parent rather than the owner: one "Drawer 2" per
            # wardrobe, but several wardrobes may each hold one.
            models.UniqueConstraint(
                fields=["owner", "parent", "name"],
                name="unique_location_name_per_parent",
            ),
            # Postgres treats NULLs as distinct, so the constraint above never
            # applies to a place with no parent. Without this one, nothing in
            # the database stops two rooms sharing a name.
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

        # len(chain) is where this row would sit, and whatever is already nested
        # inside it moves down with it. Checking the row alone would let a
        # wardrobe full of drawers be moved somewhere that leaves them no room.
        if len(chain) + self.height > self.MAX_DEPTH - 1:
            raise ValidationError(
                {"parent": f"Storage can only be nested {self.MAX_DEPTH} levels deep."}
            )

    @property
    def ancestors(self) -> list[StorageLocation]:
        """Outermost first: [Bedroom, Main Wardrobe] for Drawer 2."""
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
        """Levels nested inside this one. A drawer holding nothing is 0."""
        # An unsaved row has no pk, and children.all() would then match every
        # row whose parent is NULL rather than nothing at all.
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
    Slot, not name, is the field outfit assembly reads: a complete outfit needs
    one TOP, one BOTTOM and one FOOTWEAR, whichever names fill them.

    An owner of NULL is a built-in category shared by everyone; a non-null
    owner is one user's own addition.
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
        Carries the note from the most recent wearing, so a list can say "worn
        to Ayesha's mehndi" without a query per row.
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
        ARCHIVED = "ARCHIVED", "Archived"

    WEARABLE_STATUSES = [Status.IN_WARDROBE]

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
        on_delete=models.SET_NULL,   # a deleted drawer must not take the garment with it
        null=True,
        blank=True,
        related_name="items",
    )

    # Cloudinary deletes by public_id, and the public_id cannot be
    # reconstructed from the delivery URL, so both are stored per image.
    original_image_url = models.URLField(max_length=500, blank=True)
    original_image_public_id = models.CharField(max_length=200, blank=True)
    clean_image_url = models.URLField(
        max_length=500, blank=True, help_text="Background removed by rembg."
    )
    clean_image_public_id = models.CharField(max_length=200, blank=True)

    status = models.CharField(max_length=20, choices=Status.choices, default=Status.IN_WARDROBE)
    is_favorite = models.BooleanField(default=False)

    purchase_price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        # cost_per_wear divides by this, and a negative price would be shown to
        # the owner as a negative cost.
        validators=[MinValueValidator(Decimal("0"))],
    )
    currency = models.CharField(max_length=3, default="PKR")
    purchase_date = models.DateField(null=True, blank=True)

    # Denormalised: the closet grid renders both for every item on screen, and
    # deriving them from the wear log cost a COUNT() per row, around 40 extra
    # queries a page.
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
            # The closet list is newest-first, so this serves the owner filter
            # and the sort together instead of sorting the whole table.
            models.Index(fields=["owner", "-created_at"], name="garment_owner_recent"),
            # seasons and occasions are matched with `contains`, a lookup a
            # btree index cannot answer. GIN indexes the array entries.
            GinIndex(fields=["seasons"], name="garment_seasons_gin"),
            GinIndex(fields=["occasions"], name="garment_occasions_gin"),
            # Backs the misspelling fallback in SpellingTolerantSearch, which
            # would otherwise score every row in the table.
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
        None when no purchase price is recorded, and the full price while
        wear_count is zero rather than a division by zero.
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
        Records a wearing and returns the row with whether it was new.

        Wearing the same thing twice in one day is treated as one wearing. A
        double tap on the button is far more likely than a genuine second wear,
        and every extra tap would quietly halve cost_per_wear.
        """
        day = on_date or timezone.localdate()
        try:
            with transaction.atomic():
                event = WearEvent.objects.create(owner_id=self.owner_id, item=self, worn_on=day, note=note)
        except IntegrityError:
            # Two taps landing together: the constraint settles which one wins.
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
        Rebuilds the two summary columns from the log in one statement. Reading
        them into Python first would let two requests arriving together write
        the same value and lose a wearing.
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
    One day an item was worn.

    GarmentItem.wear_count and last_worn_date are kept in step with this table
    rather than counted from it on demand: the closet grid shows both for every
    item on screen, which would be a COUNT per row.
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
            # One wearing per item per day. Without it a repeated tap counts
            # twice and cost_per_wear reads lower than it is.
            models.UniqueConstraint(fields=["item", "worn_on"], name="one_wear_per_item_per_day"),
        ]
        indexes = [
            # "What did I wear that week" and the dashboard feed both read this
            # newest-first for one owner.
            models.Index(fields=["owner", "-worn_on"], name="wear_owner_recent"),
        ]

    def __str__(self):
        return f"{self.item.name} on {self.worn_on}"

    def clean(self):
        if self.worn_on and self.worn_on > timezone.localdate():
            raise ValidationError({"worn_on": "That day has not happened yet."})
        if self.item_id and self.owner_id and self.item.owner_id != self.owner_id:
            raise ValidationError({"item": "That item belongs to someone else."})
