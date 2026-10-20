"""
Reading a shop's published catalogue.

Most clothing shops in this market run on Shopify, and a Shopify storefront
publishes its own catalogue as JSON at /products.json. It is the shop's own
address, it needs no key, and it carries the one field that matters here:
the price a thing was cut from, which is what makes something a sale.

This module only reads and parses. Deciding what to keep is sync.py's job.
"""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass, field
from decimal import Decimal, InvalidOperation

import requests

logger = logging.getLogger(__name__)

PAGE_SIZE = 250          # the most a Shopify storefront will return at once
TIMEOUT_SECONDS = 25
MAX_SIZES_KEPT = 12

# Shops answer a plain request. Saying who is asking is basic manners and lets
# a shop refuse the request cleanly rather than having to guess.
USER_AGENT = "Closette/1.0 (wardrobe app; reads public catalogue pages)"


class FeedUnavailable(Exception):
    """Raised when a shop cannot be read. Stored rows are left untouched."""

    def __init__(self, reason: str, code: str = "unavailable"):
        super().__init__(reason)
        self.reason = reason
        self.code = code


@dataclass
class RawProduct:
    """One product exactly as the feed published it, before classification."""

    external_id: str
    title: str
    handle: str
    image_url: str
    vendor: str
    shop_category: str
    tags: list[str] = field(default_factory=list)
    price: Decimal = Decimal("0")
    was_price: Decimal | None = None
    sizes: list[str] = field(default_factory=list)
    in_stock: bool = True

    @property
    def discount_percent(self) -> int:
        if not self.was_price or self.was_price <= self.price or self.was_price <= 0:
            return 0
        return int(round(100 - (self.price * 100 / self.was_price)))


def _money(value) -> Decimal | None:
    """Shopify sends money as a string, and sometimes not at all."""
    if value in (None, ""):
        return None
    try:
        amount = Decimal(str(value))
    except (InvalidOperation, ValueError):
        return None
    return amount if amount >= 0 else None


def _cheapest_variant(variants: list[dict]) -> dict | None:
    """
    The size a shopper would actually pay least for.

    A shop often clears one size and leaves the rest at full price, and the
    figure worth showing is the one they could really get today, so anything
    in stock wins over anything that is not.
    """
    priced = [v for v in variants if _money(v.get("price")) is not None]
    if not priced:
        return None
    return min(priced, key=lambda v: (not v.get("available", False), _money(v["price"])))


def parse_product(row: dict) -> RawProduct | None:
    """One entry from the feed, or None when it carries no usable price."""
    variants = row.get("variants") or []
    chosen = _cheapest_variant(variants)
    if chosen is None:
        return None

    price = _money(chosen.get("price"))
    was = _money(chosen.get("compare_at_price"))
    # Plenty of shops fill compare_at_price in with the same number as the
    # price. That is not a sale, and showing it as "0% off" would be a lie.
    if was is not None and was <= price:
        was = None

    images = row.get("images") or []
    sizes = []
    for variant in variants:
        label = (variant.get("title") or "").strip()
        # Shopify names a product with no real options "Default Title", which
        # tells a shopper nothing.
        if variant.get("available") and label and label.lower() != "default title":
            # Options are joined with a slash, and only the first is the size.
            size = label.split("/")[0].strip()
            if size and size not in sizes:
                sizes.append(size)

    return RawProduct(
        external_id=str(row.get("id") or "").strip(),
        title=(row.get("title") or "").strip()[:300],
        handle=(row.get("handle") or "").strip()[:300],
        image_url=(images[0].get("src") if images else "") or "",
        vendor=(row.get("vendor") or "").strip()[:120],
        shop_category=(row.get("product_type") or "").strip()[:120],
        tags=[str(tag) for tag in (row.get("tags") or [])][:40],
        price=price,
        was_price=was,
        sizes=sizes[:MAX_SIZES_KEPT],
        in_stock=any(variant.get("available") for variant in variants),
    )


def _read_page(url: str, page: int) -> list[dict]:
    joiner = "&" if "?" in url else "?"
    address = f"{url}{joiner}limit={PAGE_SIZE}&page={page}"

    try:
        response = requests.get(
            address,
            timeout=TIMEOUT_SECONDS,
            headers={"User-Agent": USER_AGENT, "Accept": "application/json"},
        )
    except requests.Timeout as exc:
        raise FeedUnavailable("The shop did not answer in time.", "timeout") from exc
    except requests.RequestException as exc:
        raise FeedUnavailable("The shop could not be reached.", "unreachable") from exc

    if response.status_code == 404:
        raise FeedUnavailable("That address does not publish a catalogue.", "no_feed")
    if response.status_code == 429:
        raise FeedUnavailable("The shop asked us to slow down.", "rate_limited")
    if response.status_code >= 400:
        raise FeedUnavailable(f"The shop answered with {response.status_code}.", "bad_status")

    try:
        body = response.json()
    except ValueError as exc:
        # Usually a redirect to a holding page, which arrives as HTML.
        raise FeedUnavailable("The shop sent something that was not a catalogue.", "not_json") from exc

    products = body.get("products")
    if not isinstance(products, list):
        raise FeedUnavailable("The catalogue was in a shape we do not know.", "unknown_shape")
    return products


def fetch(shop) -> list[RawProduct]:
    """
    Everything one shop currently publishes.

    Pages are walked until the shop runs out or the shop's own page limit is
    reached, whichever comes first, with the shop's requested gap in between.
    """
    collected: list[RawProduct] = []
    seen: set[str] = set()

    for page in range(1, shop.max_pages + 1):
        rows = _read_page(shop.feed_url, page)
        if not rows:
            break

        for row in rows:
            product = parse_product(row)
            if product and product.external_id and product.external_id not in seen:
                seen.add(product.external_id)
                collected.append(product)

        if len(rows) < PAGE_SIZE:
            break
        if page < shop.max_pages and shop.request_gap_seconds > 0:
            time.sleep(shop.request_gap_seconds)

    if not collected:
        raise FeedUnavailable("The shop published nothing we could read.", "empty")

    return collected
