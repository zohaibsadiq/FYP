"""
The scheduled refresh. This is the only thing that ever talks to a shop.

Run it from Task Scheduler on Windows or cron on a server. Twice a day is
plenty for clothing, where a sale runs for weeks:

    python manage.py sync_deals

One shop on its own, which is what to reach for when a single shop is
misbehaving and the rest are fine:

    python manage.py sync_deals --shop outfitters
"""

from django.core.management.base import BaseCommand, CommandError

from apps.shopping.models import Shop
from apps.shopping.sync import sync_shop


class Command(BaseCommand):
    help = "Reads every active shop's published catalogue and records what changed."

    def add_arguments(self, parser):
        parser.add_argument(
            "--shop",
            action="append",
            dest="shops",
            metavar="SLUG",
            help="Only this shop. Repeat the flag for several.",
        )
        parser.add_argument(
            "--quiet",
            action="store_true",
            help="Print only the final line, for a scheduled run that mails its output.",
        )

    def handle(self, *args, **options):
        shops = Shop.objects.filter(is_active=True)
        if options["shops"]:
            shops = shops.filter(slug__in=options["shops"])

        if not shops.exists():
            raise CommandError("No active shops to read. Run seed_shops first.")

        worked, failed, found, reduced = 0, 0, 0, 0

        for shop in shops:
            if not options["quiet"]:
                self.stdout.write(f"Reading {shop.name}...", ending=" ")
                self.stdout.flush()

            run = sync_shop(shop)

            if run.ok:
                worked += 1
                found += run.found
                reduced += shop.deals.filter(is_listed=True, discount_percent__gt=0).count()
                if not options["quiet"]:
                    self.stdout.write(self.style.SUCCESS(
                        f"{run.found} products, {run.added} new, {run.delisted} gone, "
                        f"{run.seconds_taken}s"
                    ))
            else:
                failed += 1
                if not options["quiet"]:
                    self.stdout.write(self.style.WARNING(run.message or "failed"))

        line = f"{worked} shops read, {failed} failed, {found} products, {reduced} on sale."
        self.stdout.write(self.style.SUCCESS(line) if not failed else self.style.WARNING(line))

        # One shop refusing to answer is ordinary, and the app already says so
        # on the page. Every shop refusing is not, so the run ends in a failure
        # the scheduler can see and report rather than a quiet success.
        if worked == 0:
            raise CommandError("Not one shop could be read. Nothing was refreshed.")
