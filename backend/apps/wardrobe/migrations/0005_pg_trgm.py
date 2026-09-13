from django.contrib.postgres.operations import TrigramExtension
from django.db import migrations


class Migration(migrations.Migration):
    """
    pg_trgm has to exist before any index can use gin_trgm_ops, so it is
    enabled in its own migration ahead of the index that needs it.
    """

    dependencies = [("wardrobe", "0004_storagelocation_unique_root_location_name_per_owner")]

    operations = [TrigramExtension()]
