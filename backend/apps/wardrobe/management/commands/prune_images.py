"""
A photo is sent to Cloudinary the moment it is uploaded, which is before the
item form is saved. When somebody abandons the form, the files stay behind with
nothing pointing at them, and Cloudinary charges for stored bytes either way.
This command finds those leftover files.
"""

from django.conf import settings
from django.core.management.base import BaseCommand

from apps.vision import storage
from apps.wardrobe.models import GarmentItem


class Command(BaseCommand):
    help = "Lists Cloudinary garment images that no item refers to, and deletes them with --delete."

    def add_arguments(self, parser):
        parser.add_argument(
            "--delete",
            action="store_true",
            help="Delete what is found. Without it the command only reports.",
        )

    def handle(self, *args, **options):
        if not storage.is_configured():
            self.stderr.write("Cloudinary is not configured, nothing to do.")
            return

        referenced = set()
        for original, clean in GarmentItem.objects.values_list(
            "original_image_public_id", "clean_image_public_id"
        ):
            referenced.update(filter(None, (original, clean)))

        stored = self._stored_public_ids()
        orphans = sorted(stored - referenced)

        self.stdout.write(f"{len(stored)} stored, {len(referenced & stored)} in use, {len(orphans)} orphaned")

        if not orphans:
            return

        for public_id in orphans:
            if options["delete"]:
                result = "deleted" if storage.delete_image(public_id) else "could not delete"
            else:
                result = "would delete"
            self.stdout.write(f"  {result}  {public_id}")

        if not options["delete"]:
            self.stdout.write("Run again with --delete to remove them.")

    def _stored_public_ids(self) -> set[str]:
        import cloudinary.api

        prefix = f"{settings.CLOUDINARY_ROOT_FOLDER}/garments"
        found: set[str] = set()
        cursor = None

        while True:
            page = cloudinary.api.resources(
                type="upload", prefix=prefix, max_results=500, next_cursor=cursor
            )
            found.update(row["public_id"] for row in page.get("resources", []))
            cursor = page.get("next_cursor")
            if not cursor:
                break

        return found
