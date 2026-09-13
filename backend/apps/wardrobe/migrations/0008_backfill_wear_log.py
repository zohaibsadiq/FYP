from django.db import migrations


def build_log(apps, schema_editor):
    """
    Before this table existed only a running total and the most recent date
    were kept, so one entry per item is all that can honestly be recovered.
    Totals are then rebuilt from the log so the two always agree.
    """
    GarmentItem = apps.get_model("wardrobe", "GarmentItem")
    WearEvent = apps.get_model("wardrobe", "WearEvent")

    worn = GarmentItem.objects.exclude(last_worn_date=None)
    WearEvent.objects.bulk_create(
        [
            WearEvent(owner_id=item.owner_id, item_id=item.id, worn_on=item.last_worn_date)
            for item in worn.iterator()
        ],
        ignore_conflicts=True,
    )

    GarmentItem.objects.exclude(last_worn_date=None).update(wear_count=1)
    GarmentItem.objects.filter(last_worn_date=None).update(wear_count=0)


def clear_log(apps, schema_editor):
    apps.get_model("wardrobe", "WearEvent").objects.all().delete()


class Migration(migrations.Migration):
    dependencies = [("wardrobe", "0007_wear_event")]

    operations = [migrations.RunPython(build_log, clear_log)]
