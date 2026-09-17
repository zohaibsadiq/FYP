"""
The shops the app reads, as a starting set.

Every one of these was checked by hand before it was added: the address
answers with a catalogue, and the shop's own crawl rules allow it. Beechtree
asks for ten seconds between requests, which is honoured below.

Running this again is safe. It updates the settings and leaves each shop's
history and last-checked time alone.
"""

from django.core.management.base import BaseCommand

from apps.shopping.models import Shop

SHOPS = [
    {
        "name": "Outfitters",
        "slug": "outfitters",
        "site_url": "https://outfitters.com.pk",
        "sort_order": 10,
    },
    {
        "name": "Limelight",
        "slug": "limelight",
        "site_url": "https://www.limelight.pk",
        "sort_order": 20,
    },
    {
        "name": "Gul Ahmed",
        "slug": "gul-ahmed",
        "site_url": "https://www.gulahmedshop.com",
        "sort_order": 30,
    },
    {
        "name": "Bonanza Satrangi",
        "slug": "bonanza-satrangi",
        "site_url": "https://bonanzasatrangi.com",
        "sort_order": 40,
    },
    {
        "name": "Beechtree",
        "slug": "beechtree",
        # Their catalogue carries no menswear at all, and their children's line
        # labels itself, so anything left unsaid is womenswear.
        "default_audience": "WOMEN",
        "site_url": "https://beechtree.pk",
        "sort_order": 50,
        # Their robots file asks for ten seconds between requests.
        "request_gap_seconds": 10.0,
        "max_pages": 3,
    },
    {
        "name": "Generation",
        "slug": "generation",
        # A womenswear label. Nothing in their catalogue reads as menswear.
        "default_audience": "WOMEN",
        "site_url": "https://generation.com.pk",
        "sort_order": 60,
    },
    {
        "name": "Junaid Jamshed",
        "slug": "junaid-jamshed",
        "site_url": "https://www.junaidjamshed.com",
        "sort_order": 70,
    },
    {
        "name": "Almirah",
        "slug": "almirah",
        "site_url": "https://www.almirah.com.pk",
        "sort_order": 80,
    },
]

DEFAULTS = {
    "default_audience": "",     # assume nothing unless the shop above says so
    "feed_kind": Shop.Feed.SHOPIFY,
    "currency": "PKR",
    "is_active": True,
    "request_gap_seconds": 1.0,
    "max_pages": 4,
}


class Command(BaseCommand):
    help = "Adds the shops the app reads, or updates their settings if they are already there."

    def handle(self, *args, **options):
        added, updated = 0, 0

        for entry in SHOPS:
            values = {**DEFAULTS, **entry}
            values["feed_url"] = values["site_url"].rstrip("/") + "/products.json"
            slug = values.pop("slug")

            _, created = Shop.objects.update_or_create(slug=slug, defaults=values)
            added += int(created)
            updated += int(not created)
            self.stdout.write(f"  {'added' if created else 'updated'}  {values['name']}")

        self.stdout.write(self.style.SUCCESS(f"{added} added, {updated} updated."))
        self.stdout.write("Run `python manage.py sync_deals` to read them.")
