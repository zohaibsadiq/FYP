"""
The opposite of prune_images. That one finds pictures on Cloudinary that no
item points at. This one finds items pointing at pictures Cloudinary no
longer has, which happens when a file is deleted from the Cloudinary console
by hand. Such an item shows a broken picture until the dead link is cleared.
"""

from django.core.management.base import BaseCommand

from apps.vision import storage
from apps.wardrobe.models import GarmentItem

PICTURES = [
    ("original_image_url", "original_image_public_id"),
    ("clean_image_url", "clean_image_public_id"),
]


class Command(BaseCommand):
    help = "Lists garments whose pictures are gone from Cloudinary, and clears the dead links with --clear."

    def add_arguments(self, parser):
        parser.add_argument(
            "--clear",
            action="store_true",
            help="Clear the dead links so the items show the plain outline. Without it the command only reports.",
        )

    def handle(self, *args, **options):
        if not storage.is_configured():
            self.stderr.write("Cloudinary is not configured, nothing to do.")
            return

        import cloudinary.api

        checked = 0
        dead = 0
        for item in GarmentItem.objects.exclude(original_image_public_id="").order_by("pk"):
            gone = []
            for url_field, id_field in PICTURES:
                public_id = getattr(item, id_field)
                if not public_id:
                    continue
                checked += 1
                try:
                    cloudinary.api.resource(public_id)
                except cloudinary.api.NotFound:
                    gone.append((url_field, id_field))

            if not gone:
                continue
            dead += len(gone)
            self.stdout.write(f"  item {item.pk} ({item.name}, {item.owner.email}): {len(gone)} missing")

            if options["clear"]:
                for url_field, id_field in gone:
                    setattr(item, url_field, "")
                    setattr(item, id_field, "")
                item.save(update_fields=[f for pair in gone for f in pair] + ["updated_at"])

        self.stdout.write(f"{checked} pictures checked, {dead} missing")
        if dead and not options["clear"]:
            self.stdout.write("Run again with --clear to remove the dead links.")
