"""
Turning a shop's own wording into something the closet understands.

Shop feeds describe products with labels such as "BTK-EAST", "Women Fabric",
"Heartilicious", "PRET" and "3 Piece". None of that can be shown as a filter,
so each product is read for three things: whether it is clothing at all, where
on the body it is worn, and what colour it is.

Where it is worn is the part that has to be right, because that is what the
filter runs on. The exact kind ("Kurta" rather than just "a top") is a bonus
and is left empty rather than guessed.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

from apps.intelligence.colors import NAMED_COLORS
from apps.wardrobe.models import Category

Slot = Category.Slot

# Cloth sold by the metre gets its own kind. It is a real thing to own in this
# market, so it is named instead of being swept into "other".
UNSTITCHED_CATEGORY = "Unstitched Fabric"

# Each rule is (words to look for, category name, where it is worn). Longest
# phrase is tried first, so "formal shoes" is not swallowed by "shoes" and
# "t-shirt" is not swallowed by "shirt". Where two phrases are the same length,
# the one written first here wins, which is why tops are listed above bottoms:
# "short sleeve shirt" is a shirt, not shorts.
RULES: list[tuple[str, str, str]] = [
    # Worn top and bottom at once
    ("shalwar kameez", "Shalwar Kameez", Slot.FULL_BODY),
    ("kameez shalwar", "Shalwar Kameez", Slot.FULL_BODY),
    ("shalwar qameez", "Shalwar Kameez", Slot.FULL_BODY),
    ("stitched 3pc", "Shalwar Kameez", Slot.FULL_BODY),
    ("stitched 2pc", "Shalwar Kameez", Slot.FULL_BODY),
    ("3pc stitched", "Shalwar Kameez", Slot.FULL_BODY),
    ("2pc stitched", "Shalwar Kameez", Slot.FULL_BODY),
    ("three piece suit", "Suit", Slot.FULL_BODY),
    ("two piece suit", "Suit", Slot.FULL_BODY),
    ("co-ord set", "", Slot.FULL_BODY),
    ("jumpsuit", "", Slot.FULL_BODY),
    ("anarkali", "", Slot.FULL_BODY),
    ("lehenga", "", Slot.FULL_BODY),
    ("saree", "", Slot.FULL_BODY),
    ("abaya", "", Slot.FULL_BODY),
    ("jubba", "", Slot.FULL_BODY),
    ("thobe", "", Slot.FULL_BODY),
    ("ensemble", "", Slot.FULL_BODY),
    ("maxi", "Dress", Slot.FULL_BODY),
    ("gown", "Dress", Slot.FULL_BODY),
    ("frock", "Dress", Slot.FULL_BODY),
    ("dress", "Dress", Slot.FULL_BODY),

    # Outerwear before tops, because a "shirt jacket" is a jacket
    ("waistcoat", "Waistcoat", Slot.OUTERWEAR),
    ("bodywarmer", "Waistcoat", Slot.OUTERWEAR),
    ("blazer", "Blazer", Slot.OUTERWEAR),
    ("overcoat", "Coat", Slot.OUTERWEAR),
    ("trench", "Coat", Slot.OUTERWEAR),
    ("coat", "Coat", Slot.OUTERWEAR),
    ("jacket", "Jacket", Slot.OUTERWEAR),
    ("shrug", "", Slot.OUTERWEAR),
    ("poncho", "", Slot.OUTERWEAR),

    # Tops
    ("sweatshirt", "Hoodie", Slot.TOP),
    ("hoodie", "Hoodie", Slot.TOP),
    ("cardigan", "Sweater", Slot.TOP),
    ("pullover", "Sweater", Slot.TOP),
    ("sweater", "Sweater", Slot.TOP),
    ("jumper", "Sweater", Slot.TOP),
    ("polo", "Polo", Slot.TOP),
    ("t-shirt", "T-Shirt", Slot.TOP),
    ("tshirt", "T-Shirt", Slot.TOP),
    ("tee", "T-Shirt", Slot.TOP),
    ("kurti", "Kurta", Slot.TOP),
    ("kurta", "Kurta", Slot.TOP),
    ("blouse", "Shirt", Slot.TOP),
    ("shirt", "Shirt", Slot.TOP),
    ("eastern top", "", Slot.TOP),
    ("crop top", "", Slot.TOP),
    ("waistcoat top", "", Slot.TOP),
    ("top", "", Slot.TOP),

    # Bottoms
    ("shalwar", "Shalwar", Slot.BOTTOM),
    ("trouser", "Trousers", Slot.BOTTOM),
    ("culotte", "Trousers", Slot.BOTTOM),
    ("palazzo", "Trousers", Slot.BOTTOM),
    ("chino", "Chinos", Slot.BOTTOM),
    ("jean", "Jeans", Slot.BOTTOM),
    ("short", "Shorts", Slot.BOTTOM),
    ("skirt", "Skirt", Slot.BOTTOM),
    ("legging", "Trousers", Slot.BOTTOM),
    ("pant", "Trousers", Slot.BOTTOM),
    ("bottom", "", Slot.BOTTOM),

    # Footwear
    ("formal shoe", "Formal Shoes", Slot.FOOTWEAR),
    ("dress shoe", "Formal Shoes", Slot.FOOTWEAR),
    ("oxford", "Formal Shoes", Slot.FOOTWEAR),
    ("loafer", "Formal Shoes", Slot.FOOTWEAR),
    ("brogue", "Formal Shoes", Slot.FOOTWEAR),
    ("sneaker", "Sneakers", Slot.FOOTWEAR),
    ("trainer", "Sneakers", Slot.FOOTWEAR),
    ("khussa", "Khussa", Slot.FOOTWEAR),
    ("kolhapuri", "Khussa", Slot.FOOTWEAR),
    ("peshawari", "Khussa", Slot.FOOTWEAR),
    ("sandal", "Sandals", Slot.FOOTWEAR),
    ("slipper", "Sandals", Slot.FOOTWEAR),
    ("chappal", "Sandals", Slot.FOOTWEAR),
    ("boot", "Boots", Slot.FOOTWEAR),
    ("heel", "", Slot.FOOTWEAR),
    ("footwear", "", Slot.FOOTWEAR),
    ("shoe", "", Slot.FOOTWEAR),

    # Headwear
    ("baseball cap", "Cap", Slot.HEADWEAR),
    ("turban", "", Slot.HEADWEAR),
    ("cap", "Cap", Slot.HEADWEAR),
    ("hat", "Hat", Slot.HEADWEAR),

    # Accessories
    ("sunglass", "Sunglasses", Slot.ACCESSORY),
    ("jewellery", "Jewellery", Slot.ACCESSORY),
    ("jewelry", "Jewellery", Slot.ACCESSORY),
    ("earring", "Jewellery", Slot.ACCESSORY),
    ("necklace", "Jewellery", Slot.ACCESSORY),
    ("bracelet", "Jewellery", Slot.ACCESSORY),
    ("bangle", "Jewellery", Slot.ACCESSORY),
    ("anklet", "Jewellery", Slot.ACCESSORY),
    ("watch", "Watch", Slot.ACCESSORY),
    ("wallet", "", Slot.ACCESSORY),
    ("belt", "Belt", Slot.ACCESSORY),
    ("necktie", "Tie", Slot.ACCESSORY),
    ("bow tie", "Tie", Slot.ACCESSORY),
    ("dupatta", "Scarf", Slot.ACCESSORY),
    ("stole", "Scarf", Slot.ACCESSORY),
    ("shawl", "Scarf", Slot.ACCESSORY),
    ("scarf", "Scarf", Slot.ACCESSORY),
    ("scarves", "Scarf", Slot.ACCESSORY),
    ("handbag", "Bag", Slot.ACCESSORY),
    ("backpack", "Bag", Slot.ACCESSORY),
    ("clutch", "Bag", Slot.ACCESSORY),
    ("tote", "Bag", Slot.ACCESSORY),
    ("pouch", "Bag", Slot.ACCESSORY),
    ("bag", "Bag", Slot.ACCESSORY),
    ("ring", "Jewellery", Slot.ACCESSORY),
    ("tie", "Tie", Slot.ACCESSORY),

    # A stitched suit of any cut, once everything more specific has had a
    # turn. Unstitched cloth is ruled out before any of these are tried, so
    # "3 piece" reaching here means a suit somebody can actually put on.
    ("three piece", "Shalwar Kameez", Slot.FULL_BODY),
    ("two piece", "Shalwar Kameez", Slot.FULL_BODY),
    ("3 piece", "Shalwar Kameez", Slot.FULL_BODY),
    ("2 piece", "Shalwar Kameez", Slot.FULL_BODY),
    ("3 pc", "Shalwar Kameez", Slot.FULL_BODY),
    ("2 pc", "Shalwar Kameez", Slot.FULL_BODY),
    ("suit", "Shalwar Kameez", Slot.FULL_BODY),
]

# Cloth sold by the metre, which is a large part of what these shops publish.
# It is clothing to come, not clothing yet, so it gets its own kind.
UNSTITCHED = [
    "unstitched",
    "un-stitched",
    "unstiched",
    "fabric",
    "yardage",
]

# Not clothing at all. These are dropped rather than filed under "other",
# because a wardrobe app listing bedsheets and perfume is a worse page.
NOT_CLOTHING = [
    "home",
    "bedsheet",
    "bed sheet",
    "bedding",
    "duvet",
    "quilt",
    "cushion",
    "pillow",
    "towel",
    "curtain",
    "table runner",
    "crockery",
    "perfume",
    "fragrance",
    "attar",
    "deodorant",
    "body spray",
    "body mist",
    "lipstick",
    "makeup",
    "skincare",
    "beauty",
    "gift card",
    "underwear",
    "lingerie",
    "brief",
    "boxer",
]

# Colour words shops use that are spelled differently from the names in
# NAMED_COLORS.
COLOR_ALIASES: dict[str, str] = {
    "ivory": "Off White",
    "offwhite": "Off White",
    "wine": "Maroon",
    "burgundy": "Maroon",
    "peach": "Blush",
    "fawn": "Tan",
    "sea green": "Emerald",
    "bottle green": "Emerald",
    "steel grey": "Charcoal",
    "charcoal grey": "Charcoal",
    "light blue": "Sky Blue",
    "dark blue": "Navy",
    # Two words of the same length, so without the pair spelled out "navy blue"
    # is read as plain blue.
    "navy blue": "Navy",
    "indigo": "Navy",
    "silver": "Light Grey",
    "gray": "Grey",
    "light gray": "Light Grey",
}

_COLOR_HEX = {name.lower(): hex_value for name, hex_value in NAMED_COLORS}

_TIDY = re.compile(r"[^a-z0-9]+")


def _pattern(phrase: str) -> re.Pattern:
    """
    A phrase as a whole-word match that tolerates a plural.

    Whole words matter: without them "ring" would match "earring" and "top"
    would match "laptop". The optional ending is what lets one rule cover
    "sandal" and "sandals" without writing both.
    """
    words = _TIDY.sub(" ", phrase.lower()).strip().split()
    joined = r"\s+".join(re.escape(word) for word in words)
    return re.compile(r"\b" + joined + r"(?:s|es)?\b")


def _flatten(text: str) -> str:
    """Lower case with single spaces, so 'T-Shirt' and 't shirt' read alike."""
    return _TIDY.sub(" ", (text or "").lower()).strip()


# Longest phrase first, and among equal lengths the order written above. Python
# keeps the original order for ties, so nothing gets scrambled.
_COMPILED_RULES = [
    (_pattern(phrase), category, slot)
    for phrase, category, slot in sorted(
        RULES, key=lambda rule: -len(rule[0])
    )
]
_UNSTITCHED_PATTERNS = [_pattern(phrase) for phrase in UNSTITCHED]
_NOT_CLOTHING_PATTERNS = [_pattern(phrase) for phrase in NOT_CLOTHING]

_COLOR_PATTERNS = [
    (_pattern(phrase), name)
    for phrase, name in sorted(
        [(name.lower(), name) for name, _ in NAMED_COLORS]
        + list(COLOR_ALIASES.items()),
        key=lambda pair: -len(pair[0]),
    )
]


# Who a thing is meant for. The shops say so themselves, usually in their tags
# and in the vendor line, so this is read rather than guessed. Anything that
# does not say stays UNKNOWN and shows only under "Everything", because putting
# a man's shirt in the women's tab is worse than leaving it out of both.
KIDS_WORDS = ["kid", "junior", "toddler", "boy", "girl", "baby", "infant",
              "child", "children", "btk", "btkids"]
MEN_WORDS = ["men", "man", "gents", "gentlemen", "male", "mens", "menswear"]
WOMEN_WORDS = ["women", "woman", "ladies", "lady", "female", "womens", "womenswear"]

_KIDS_PATTERNS = [_pattern(w) for w in KIDS_WORDS]
_MEN_PATTERNS = [_pattern(w) for w in MEN_WORDS]
_WOMEN_PATTERNS = [_pattern(w) for w in WOMEN_WORDS]


@dataclass(frozen=True)
class Reading:
    category_name: str
    slot: str
    color_name: str
    color_hex: str
    audience: str = "UNKNOWN"


def is_clothing(text: str) -> bool:
    flat = _flatten(text)
    return not any(pattern.search(flat) for pattern in _NOT_CLOTHING_PATTERNS)


def is_unstitched(text: str) -> bool:
    flat = _flatten(text)
    return any(pattern.search(flat) for pattern in _UNSTITCHED_PATTERNS)


def read_color(text: str) -> tuple[str, str]:
    """The colour named in a product title, or empty when none is."""
    flat = _flatten(text)
    for pattern, name in _COLOR_PATTERNS:
        if pattern.search(flat):
            return name, _COLOR_HEX.get(name.lower(), "")
    return "", ""


def read_kind(text: str) -> tuple[str, str]:
    """
    The category and slot a piece of wording means.

    The category comes back empty whenever the wording only says roughly where
    something is worn. "Eastern Top" is certainly a top and certainly not a
    shirt, so it gets the slot and nothing more.
    """
    flat = _flatten(text)
    for pattern, category_name, slot in _COMPILED_RULES:
        if pattern.search(flat):
            return category_name, slot
    return "", Slot.OTHER


def read_audience(product) -> str:
    """
    Who the shop says a thing is for.

    Children come first on purpose: "Girls Junior" and "Boys Toddler" are the
    children's half of a shop that also sells to adults, and the child is the
    fact that matters. After that, women are tested before men on each piece
    of text, because "womenswear" would otherwise be read as menswear by
    anything looking for the shorter word.

    Tags carry this better than anything else, because a shop files a product
    under its own department before it writes a title.
    """
    sources = [
        " ".join(product.tags or []),
        product.vendor,
        product.shop_category,
        product.title,
    ]

    for text in sources:
        flat = _flatten(text)
        if any(p.search(flat) for p in _KIDS_PATTERNS):
            return "KIDS"

    for text in sources:
        flat = _flatten(text)
        if any(p.search(flat) for p in _WOMEN_PATTERNS):
            return "WOMEN"
        if any(p.search(flat) for p in _MEN_PATTERNS):
            return "MEN"

    return "UNKNOWN"


def read(product) -> Reading | None:
    """
    Returns None when the product is not clothing and should not be stored.

    The shop's own category outranks the title. "Kameez Shalwar" as the
    category says what the garment is, while the same words in a title may
    describe what it is worn with. Tags are read last and only to find the
    kind, because they carry stray values such as "sales tax 15%" and cannot
    safely rule anything out.
    """
    plain = f"{product.shop_category} {product.title}"

    if not is_clothing(plain):
        return None

    color_name, color_hex = read_color(product.title)

    audience = read_audience(product)

    if is_unstitched(plain):
        return Reading(UNSTITCHED_CATEGORY, Slot.OTHER, color_name, color_hex, audience)

    category_name, slot = read_kind(product.shop_category)
    if slot == Slot.OTHER:
        category_name, slot = read_kind(product.title)
    if slot == Slot.OTHER and product.tags:
        category_name, slot = read_kind(" ".join(product.tags))

    return Reading(category_name, slot, color_name, color_hex, audience)


def system_categories() -> dict[str, Category]:
    """Built-in categories by lower-case name, loaded once per refresh."""
    return {
        category.name.lower(): category
        for category in Category.objects.filter(owner__isnull=True)
    }
