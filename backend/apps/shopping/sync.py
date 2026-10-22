"""
When a refresh fails, the stored rows are left exactly as they were, still
carrying the time of the last successful read. So the "prices checked 2 hours
ago" message on screen stays truthful instead of being reset by a failure.
"""

from __future__ import annotations

import logging

from django.db import transaction
from django.utils import timezone

from . import classify
from .feeds import FeedUnavailable, RawProduct, fetch
from .models import Deal, PriceChange, Shop, SyncRun

logger = logging.getLogger(__name__)

# Fields that are refreshed every time. is_listed and the timestamps are set
# alongside them; first_seen_at is never touched again after the first sight.
REFRESHED = [
    "title",
    "handle",
    "url",
    "image_url",
    "vendor",
    "shop_category",
    "category",
    "slot",
    "color_name",
    "color_hex",
    "audience",
    "price",
    "was_price",
    "discount_percent",
    "sizes",
    "in_stock",
    "is_listed",
    "checked_at",
    "price_fell_at",
]


def _apply(deal: Deal, product: RawProduct, reading, shop: Shop, categories: dict, now) -> None:
    """Copies one freshly read product onto a row, without saving it."""
    deal.title = product.title
    deal.handle = product.handle
    deal.url = shop.product_url(product.handle) if product.handle else shop.site_url
    deal.image_url = product.image_url[:500]
    deal.vendor = product.vendor
    deal.shop_category = product.shop_category
    deal.category = categories.get(reading.category_name.lower()) if reading.category_name else None
    deal.slot = reading.slot
    deal.color_name = reading.color_name
    deal.color_hex = reading.color_hex
    # The shop's house default fills in only where the product itself was
    # silent, so anything the product did say always wins.
    deal.audience = reading.audience
    if reading.audience == Deal.Audience.UNKNOWN and shop.default_audience:
        deal.audience = shop.default_audience
    deal.price = product.price
    deal.was_price = product.was_price
    deal.discount_percent = product.discount_percent
    deal.sizes = product.sizes
    deal.in_stock = product.in_stock
    deal.is_listed = True
    deal.checked_at = now


def sync_shop(shop: Shop) -> SyncRun:
    """Reads one shop and writes what changed. Never raises for a shop's own faults."""
    run = SyncRun.objects.create(shop=shop, started_at=timezone.now())

    try:
        products = fetch(shop)
    except FeedUnavailable as exc:
        shop.record_failure(exc.reason)
        run.ok = False
        run.message = exc.reason
        run.finished_at = timezone.now()
        run.save(update_fields=["ok", "message", "finished_at"])
        logger.warning("Could not read %s: %s", shop.name, exc.reason)
        return run
    except Exception as exc:  # anything not foreseen above
        shop.record_failure("Something went wrong while reading this shop.")
        run.ok = False
        run.message = str(exc)[:300]
        run.finished_at = timezone.now()
        run.save(update_fields=["ok", "message", "finished_at"])
        logger.exception("Reading %s failed", shop.name)
        return run

    now = timezone.now()
    categories = classify.system_categories()
    existing = {deal.external_id: deal for deal in Deal.objects.filter(shop=shop)}

    to_create: list[Deal] = []
    to_update: list[Deal] = []
    price_changes: list[PriceChange] = []

    kept = 0
    seen: set[str] = set()

    for product in products:
        reading = classify.read(product)
        if reading is None:
            # Bedsheets, perfume and the rest of what a clothing shop also
            # sells. Left out entirely rather than filed under "other".
            continue

        kept += 1
        seen.add(product.external_id)
        deal = existing.get(product.external_id)

        if deal is None:
            deal = Deal(shop=shop, external_id=product.external_id, first_seen_at=now)
            _apply(deal, product, reading, shop, categories, now)
            to_create.append(deal)
            continue

        moved = deal.price != product.price or deal.was_price != product.was_price
        fell = product.price < deal.price
        previous_drop = deal.price_fell_at

        _apply(deal, product, reading, shop, categories, now)
        deal.price_fell_at = now if fell else previous_drop

        if moved:
            price_changes.append(
                PriceChange(deal=deal, price=product.price, was_price=product.was_price, noticed_at=now)
            )
        to_update.append(deal)

    gone = [deal for external_id, deal in existing.items() if external_id not in seen and deal.is_listed]

    with transaction.atomic():
        created = Deal.objects.bulk_create(to_create, batch_size=500)
        if to_update:
            Deal.objects.bulk_update(to_update, REFRESHED, batch_size=500)
        if gone:
            Deal.objects.filter(pk__in=[deal.pk for deal in gone]).update(
                is_listed=False, checked_at=now
            )

        # A price change for a brand new row would only repeat what the row
        # already says, so history starts from the first time a price moves.
        if price_changes:
            PriceChange.objects.bulk_create(price_changes, batch_size=500)

    shop.record_success(f"{kept} clothing products read out of {len(products)} published.")

    run.ok = True
    run.found = kept
    run.added = len(created)
    run.updated = len(to_update)
    run.delisted = len(gone)
    run.finished_at = timezone.now()
    run.save(update_fields=["ok", "found", "added", "updated", "delisted", "finished_at"])
    return run

