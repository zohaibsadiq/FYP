"""
The core of the whole system: what you own, and where it physically is.

Three models:
    StorageLocation  - a tree: Bedroom -> Wardrobe -> Drawer 2
    Category         - Shirt, Jeans, Sneakers... each belonging to a "slot"
    GarmentItem      - one physical piece of clothing

Design note worth knowing for your defence:
Every field here exists because a later phase needs it. `warmth_level` and
`occasions` look unnecessary now, but the Phase 4 suggestion engine cannot work
without them - and adding columns to a table that already holds real data is
much more painful than defining them up front.
"""

from __future__ import annotations

from django.conf import settings
from django.contrib.postgres.fields import ArrayField
from django.core.exceptions import ValidationError
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.utils import timezone


# ===========================================================================
#  1. STORAGE LOCATION - the feature commercial apps do not have
# ===========================================================================

class StorageLocation(models.Model):
    """
    One physical place, which may sit inside another place.

    A row points at its parent, so the same table stores every level:

        Bedroom            (parent = None)
         └─ Main Wardrobe  (parent = Bedroom)
             └─ Drawer 2   (parent = Main Wardrobe)

    This is called an "adjacency list". It is the simplest tree design and it
    is the right choice here because closets are shallow - three or four levels
    at most - so the recursion never gets expensive.
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

    MAX_DEPTH = 4  # Room -> Wardrobe -> Drawer -> Slot is deep enough

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="storage_locations",
    )
    name = models.CharField(max_length=80, help_text="e.g. 'Main Wardrobe' or 'Drawer 2'")
    kind = models.CharField(max_length=20, choices=Kind.choices, default=Kind.OTHER)

    parent = models.ForeignKey(
        "self",
        on_delete=models.CASCADE,       # deleting a wardrobe deletes its drawers
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
            # Two drawers in the SAME wardrobe cannot both be called "Drawer 2".
            # Two different wardrobes each having a "Drawer 2" is fine.
            models.UniqueConstraint(
                fields=["owner", "parent", "name"],
                name="unique_location_name_per_parent",
            ),
        ]
        indexes = [models.Index(fields=["owner", "parent"])]

    def __str__(self):
        return self.full_path

    # -- validation ---------------------------------------------------------

    def clean(self):
        """
        Stops two things that would break the tree:
          1. a location being its own ancestor (an infinite loop)
          2. nesting deeper than MAX_DEPTH
        """
        if self.parent_id:
            if self.parent_id == self.pk:
                raise ValidationError({"parent": "A location cannot be inside itself."})

            # Walk up the chain looking for ourselves
            ancestor = self.parent
            depth = 1
            while ancestor is not None:
                if ancestor.pk == self.pk:
                    raise ValidationError(
                        {"parent": "That would create a loop - this is already a parent of it."}
                    )
                depth += 1
                if depth > self.MAX_DEPTH:
                    raise ValidationError(
                        {"parent": f"Storage can only be nested {self.MAX_DEPTH} levels deep."}
                    )
                ancestor = ancestor.parent

            if self.parent.owner_id != self.owner_id:
                raise ValidationError({"parent": "That location belongs to someone else."})

    # -- helpers ------------------------------------------------------------

    @property
    def ancestors(self) -> list[StorageLocation]:
        """From the top down: [Bedroom, Main Wardrobe] for Drawer 2."""
        chain: list[StorageLocation] = []
        node = self.parent
        while node is not None:
            chain.append(node)
            node = node.parent
        return list(reversed(chain))

    @property
    def full_path(self) -> str:
        """'Bedroom → Main Wardrobe → Drawer 2' - what the user actually reads."""
        return " → ".join([*(a.name for a in self.ancestors), self.name])

    @property
    def depth(self) -> int:
        return len(self.ancestors)

    def descendant_ids(self) -> list[int]:
        """
        Every location inside this one, at any level, plus itself.

        Used by "show me everything in the Bedroom" - which must include items
        stored in the drawers inside the wardrobe inside that bedroom.
        """
        ids = [self.pk]
        stack = list(self.children.all())
        while stack:
            node = stack.pop()
            ids.append(node.pk)
            stack.extend(node.children.all())
        return ids


# ===========================================================================
#  2. CATEGORY
# ===========================================================================

class Category(models.Model):
    """
    'Shirt', 'Jeans', 'Sneakers'.

    The important field is `slot`, not `name`. An outfit needs one TOP, one
    BOTTOM and one pair of FOOTWEAR - it does not care whether the top is a
    shirt or a sweater. Phase 4's outfit builder works entirely off slots.

    `owner = NULL` means a built-in category everyone sees. A user can add their
    own (e.g. 'Waistcoat') without affecting anybody else.
    """

    class Slot(models.TextChoices):
        TOP = "TOP", "Top"                    # shirt, t-shirt, blouse, sweater
        BOTTOM = "BOTTOM", "Bottom"           # jeans, trousers, skirt
        FULL_BODY = "FULL_BODY", "Full body"  # dress, kurta, jumpsuit - fills TOP+BOTTOM
        OUTERWEAR = "OUTERWEAR", "Outerwear"  # jacket, blazer, coat
        FOOTWEAR = "FOOTWEAR", "Footwear"
        ACCESSORY = "ACCESSORY", "Accessory"  # watch, belt, bag, scarf
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


# ===========================================================================
#  3. GARMENT ITEM - one piece of clothing
# ===========================================================================

class GarmentItem(models.Model):
    """One physical thing you own."""

    # -- lifecycle ----------------------------------------------------------
    class Status(models.TextChoices):
        IN_WARDROBE = "IN_WARDROBE", "In wardrobe"
        IN_LAUNDRY = "IN_LAUNDRY", "In the wash"
        LENT_OUT = "LENT_OUT", "Lent to a friend"     # Phase 6
        FOR_SALE = "FOR_SALE", "Listed for sale"      # Phase 6
        SOLD = "SOLD", "Sold"                         # Phase 6
        ARCHIVED = "ARCHIVED", "Archived"

    # Statuses where the item can actually be worn today.
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

    # -- ownership ----------------------------------------------------------
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="garments",
    )

    # -- what it is ---------------------------------------------------------
    name = models.CharField(max_length=120, help_text="e.g. 'Navy linen shirt'")
    category = models.ForeignKey(
        Category,
        on_delete=models.PROTECT,   # never silently orphan items
        related_name="items",
    )
    brand = models.CharField(max_length=60, blank=True)
    size = models.CharField(max_length=20, blank=True)
    material = models.CharField(max_length=60, blank=True)
    pattern = models.CharField(max_length=20, choices=Pattern.choices, default=Pattern.SOLID)

    # -- colour (filled automatically from the image, editable by the user) --
    primary_color_hex = models.CharField(
        max_length=7, blank=True, help_text="#1a2b3c - detected from the photo"
    )
    primary_color_name = models.CharField(max_length=30, blank=True, help_text="e.g. 'Navy'")
    secondary_color_hex = models.CharField(max_length=7, blank=True)

    # -- context, used by the Phase 4 suggestion engine ---------------------
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

    # -- where it physically is ---------------------------------------------
    storage_location = models.ForeignKey(
        StorageLocation,
        on_delete=models.SET_NULL,   # deleting a drawer must not delete the shirt
        null=True,
        blank=True,
        related_name="items",
    )

    # -- images -------------------------------------------------------------
    # We keep the public_id alongside every URL because deleting an image from
    # Cloudinary needs the public_id, and we cannot reconstruct it from the URL.
    original_image_url = models.URLField(max_length=500, blank=True)
    original_image_public_id = models.CharField(max_length=200, blank=True)
    clean_image_url = models.URLField(
        max_length=500, blank=True, help_text="Background removed by rembg."
    )
    clean_image_public_id = models.CharField(max_length=200, blank=True)

    # -- state --------------------------------------------------------------
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.IN_WARDROBE)
    is_favorite = models.BooleanField(default=False)

    # -- money and usage ----------------------------------------------------
    purchase_price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    currency = models.CharField(max_length=3, default="PKR")
    purchase_date = models.DateField(null=True, blank=True)

    # Denormalised on purpose: these could be computed from the WearLog table
    # (Phase 3), but the closet grid shows them for every item on screen. Doing
    # a COUNT() per item would be 40 extra queries per page load.
    wear_count = models.PositiveIntegerField(default=0)
    last_worn_date = models.DateField(null=True, blank=True)

    notes = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "garment_items"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["owner", "status"]),
            models.Index(fields=["owner", "category"]),
            models.Index(fields=["owner", "last_worn_date"]),
            models.Index(fields=["owner", "storage_location"]),
        ]

    def __str__(self):
        return f"{self.name} ({self.owner.email})"

    # -- derived values the frontend shows ----------------------------------

    @property
    def display_image_url(self) -> str:
        """Prefer the cutout; fall back to the original if rembg has not run."""
        return self.clean_image_url or self.original_image_url

    @property
    def cost_per_wear(self) -> float | None:
        """
        The number that changes how people think about their clothes.
        A 12,000 PKR jacket worn 60 times costs 200 per wear. Worn twice, 6,000.

        Returns None when we do not know the price, and the full price when it
        has never been worn (which is the honest answer, not a divide-by-zero).
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
        """False while it is in the wash, lent out, or sold."""
        return self.status in self.WEARABLE_STATUSES

    @property
    def location_path(self) -> str:
        """'Bedroom → Main Wardrobe → Drawer 2', or empty if not assigned."""
        return self.storage_location.full_path if self.storage_location else ""

    # -- actions ------------------------------------------------------------

    def mark_worn(self, on_date=None) -> None:
        """
        Called when the user confirms they wore this. Phase 3 wires it to the
        wear log; keeping the logic on the model means both the API and the
        admin panel behave identically.
        """
        self.wear_count += 1
        self.last_worn_date = on_date or timezone.localdate()
        self.save(update_fields=["wear_count", "last_worn_date", "updated_at"])
