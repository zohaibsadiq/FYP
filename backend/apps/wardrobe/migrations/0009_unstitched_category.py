"""
Data migration: cloth bought by the metre, to be stitched later.

Around one in seven things these shops publish is unstitched, and people here
genuinely own it and keep track of it. Without a name for it, all of that sat
under "other" alongside anything else we could not read.
"""

from django.db import migrations

CATEGORY = ("Unstitched Fabric", "OTHER", "scissors", 90)


def seed(apps, schema_editor):
    Category = apps.get_model("wardrobe", "Category")
    name, slot, icon, order = CATEGORY
    Category.objects.get_or_create(
        owner=None,
        name=name,
        defaults={"slot": slot, "icon": icon, "sort_order": order},
    )


def unseed(apps, schema_editor):
    Category = apps.get_model("wardrobe", "Category")
    Category.objects.filter(owner__isnull=True, name=CATEGORY[0]).delete()


class Migration(migrations.Migration):
    dependencies = [("wardrobe", "0008_backfill_wear_log")]
    operations = [migrations.RunPython(seed, unseed)]
