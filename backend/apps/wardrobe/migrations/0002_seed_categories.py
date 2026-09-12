"""Data migration: every environment gets the built-in categories on migrate."""

from django.db import migrations

# (name, slot, lucide icon, sort order)
DEFAULT_CATEGORIES = [
    ("T-Shirt", "TOP", "shirt", 10),
    ("Shirt", "TOP", "shirt", 11),
    ("Polo", "TOP", "shirt", 12),
    ("Sweater", "TOP", "shirt", 13),
    ("Hoodie", "TOP", "shirt", 14),
    ("Kurta", "TOP", "shirt", 15),
    ("Jeans", "BOTTOM", "square", 20),
    ("Trousers", "BOTTOM", "square", 21),
    ("Chinos", "BOTTOM", "square", 22),
    ("Shorts", "BOTTOM", "square", 23),
    ("Skirt", "BOTTOM", "square", 24),
    ("Shalwar", "BOTTOM", "square", 25),
    ("Dress", "FULL_BODY", "person-standing", 30),
    ("Suit", "FULL_BODY", "person-standing", 31),
    ("Shalwar Kameez", "FULL_BODY", "person-standing", 32),
    ("Jacket", "OUTERWEAR", "layers", 40),
    ("Blazer", "OUTERWEAR", "layers", 41),
    ("Coat", "OUTERWEAR", "layers", 42),
    ("Waistcoat", "OUTERWEAR", "layers", 43),
    ("Sneakers", "FOOTWEAR", "footprints", 50),
    ("Formal Shoes", "FOOTWEAR", "footprints", 51),
    ("Sandals", "FOOTWEAR", "footprints", 52),
    ("Boots", "FOOTWEAR", "footprints", 53),
    ("Khussa", "FOOTWEAR", "footprints", 54),
    ("Watch", "ACCESSORY", "watch", 60),
    ("Belt", "ACCESSORY", "minus", 61),
    ("Bag", "ACCESSORY", "briefcase", 62),
    ("Scarf", "ACCESSORY", "wind", 63),
    ("Sunglasses", "ACCESSORY", "glasses", 64),
    ("Tie", "ACCESSORY", "minus", 65),
    ("Jewellery", "ACCESSORY", "gem", 66),
    ("Cap", "HEADWEAR", "hard-hat", 70),
    ("Hat", "HEADWEAR", "hard-hat", 71),
]


def seed(apps, schema_editor):
    Category = apps.get_model("wardrobe", "Category")

    Category.objects.bulk_create(
        [
            Category(name=name, slot=slot, icon=icon, sort_order=order, owner=None)
            for name, slot, icon, order in DEFAULT_CATEGORIES
        ],
        ignore_conflicts=True,  # re-running the migration must not raise
    )


def unseed(apps, schema_editor):
    Category = apps.get_model("wardrobe", "Category")
    Category.objects.filter(
        owner__isnull=True,
        name__in=[name for name, _, _, _ in DEFAULT_CATEGORIES],
    ).delete()


class Migration(migrations.Migration):
    dependencies = [("wardrobe", "0001_initial")]
    operations = [migrations.RunPython(seed, unseed)]
