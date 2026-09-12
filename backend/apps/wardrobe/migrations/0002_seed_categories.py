"""
Seeds the built-in categories.

This is a "data migration": it changes DATA, not table structure. Putting it in
a migration (rather than a script you have to remember to run) means your
teammate's database and the deployed database both get these rows automatically
when they run `migrate`. Nobody has to be told about it.
"""

from django.db import migrations

# (name, slot, lucide icon, sort order)
DEFAULT_CATEGORIES = [
    # --- Tops ---
    ("T-Shirt", "TOP", "shirt", 10),
    ("Shirt", "TOP", "shirt", 11),
    ("Polo", "TOP", "shirt", 12),
    ("Sweater", "TOP", "shirt", 13),
    ("Hoodie", "TOP", "shirt", 14),
    ("Kurta", "TOP", "shirt", 15),
    # --- Bottoms ---
    ("Jeans", "BOTTOM", "square", 20),
    ("Trousers", "BOTTOM", "square", 21),
    ("Chinos", "BOTTOM", "square", 22),
    ("Shorts", "BOTTOM", "square", 23),
    ("Skirt", "BOTTOM", "square", 24),
    ("Shalwar", "BOTTOM", "square", 25),
    # --- Full body ---
    ("Dress", "FULL_BODY", "person-standing", 30),
    ("Suit", "FULL_BODY", "person-standing", 31),
    ("Shalwar Kameez", "FULL_BODY", "person-standing", 32),
    # --- Outerwear ---
    ("Jacket", "OUTERWEAR", "layers", 40),
    ("Blazer", "OUTERWEAR", "layers", 41),
    ("Coat", "OUTERWEAR", "layers", 42),
    ("Waistcoat", "OUTERWEAR", "layers", 43),
    # --- Footwear ---
    ("Sneakers", "FOOTWEAR", "footprints", 50),
    ("Formal Shoes", "FOOTWEAR", "footprints", 51),
    ("Sandals", "FOOTWEAR", "footprints", 52),
    ("Boots", "FOOTWEAR", "footprints", 53),
    ("Khussa", "FOOTWEAR", "footprints", 54),
    # --- Accessories ---
    ("Watch", "ACCESSORY", "watch", 60),
    ("Belt", "ACCESSORY", "minus", 61),
    ("Bag", "ACCESSORY", "briefcase", 62),
    ("Scarf", "ACCESSORY", "wind", 63),
    ("Sunglasses", "ACCESSORY", "glasses", 64),
    ("Tie", "ACCESSORY", "minus", 65),
    ("Jewellery", "ACCESSORY", "gem", 66),
    # --- Headwear ---
    ("Cap", "HEADWEAR", "hard-hat", 70),
    ("Hat", "HEADWEAR", "hard-hat", 71),
]


def seed(apps, schema_editor):
    """
    Note: we use apps.get_model(), NOT a direct import of Category.

    Reason: migrations must keep working even if the model changes later. This
    gives us the model exactly as it looked at THIS point in history.
    """
    Category = apps.get_model("wardrobe", "Category")

    Category.objects.bulk_create(
        [
            Category(name=name, slot=slot, icon=icon, sort_order=order, owner=None)
            for name, slot, icon, order in DEFAULT_CATEGORIES
        ],
        ignore_conflicts=True,  # safe to run twice
    )


def unseed(apps, schema_editor):
    """Lets `migrate wardrobe 0001` undo this cleanly."""
    Category = apps.get_model("wardrobe", "Category")
    Category.objects.filter(
        owner__isnull=True,
        name__in=[name for name, _, _, _ in DEFAULT_CATEGORIES],
    ).delete()


class Migration(migrations.Migration):
    dependencies = [("wardrobe", "0001_initial")]
    operations = [migrations.RunPython(seed, unseed)]
