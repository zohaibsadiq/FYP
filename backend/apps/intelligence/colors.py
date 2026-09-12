"""
Colour utilities.

Right now this turns a hex code into a human word ("#1b2f55" -> "Navy") so the
closet can be filtered by colour and the item title reads naturally.

In Phase 4 the same module gains the colour-harmony rules (complementary,
analogous, monochromatic) that score whether two garments go together. Keeping
all colour logic in one file means that work does not get scattered later.
"""

from __future__ import annotations

import colorsys

# A deliberately small, wearable palette. Naming every one of 16 million hex
# values is pointless - what a user needs is "is this navy or is it black".
#
# (name, hex) - chosen to cover the colours clothes are actually made in.
NAMED_COLORS: list[tuple[str, str]] = [
    ("Black", "#000000"),
    ("Charcoal", "#36454f"),
    ("Grey", "#808080"),
    ("Light Grey", "#d3d3d3"),
    ("White", "#ffffff"),
    ("Off White", "#f5f0e6"),
    ("Cream", "#fffdd0"),
    ("Beige", "#d9c5a0"),
    ("Tan", "#c49a6c"),
    ("Camel", "#b08d57"),
    ("Brown", "#6b4423"),
    ("Chocolate", "#3d2314"),
    ("Maroon", "#6d2029"),
    ("Red", "#c0392b"),
    ("Rust", "#b7410e"),
    ("Orange", "#e07b39"),
    ("Mustard", "#d4a017"),
    ("Yellow", "#f1c40f"),
    ("Olive", "#6b6b23"),
    ("Khaki", "#9a8b5f"),
    ("Green", "#2e7d4f"),
    ("Emerald", "#1f7a5a"),
    ("Mint", "#a8d8c0"),
    ("Teal", "#17787c"),
    ("Sky Blue", "#87ceeb"),
    ("Blue", "#2563a8"),
    ("Royal Blue", "#1e40af"),
    ("Navy", "#1b2f55"),
    ("Denim", "#4a6fa5"),
    ("Purple", "#6b3fa0"),
    ("Lavender", "#b8a9d9"),
    ("Magenta", "#a63b7a"),
    ("Pink", "#e39bb4"),
    ("Blush", "#f0c9c9"),
    ("Gold", "#c9a227"),
    ("Silver", "#c0c0c0"),
]


def hex_to_rgb(value: str) -> tuple[int, int, int]:
    value = value.lstrip("#")
    return int(value[0:2], 16), int(value[2:4], 16), int(value[4:6], 16)


def rgb_to_hex(r: int, g: int, b: int) -> str:
    return f"#{r:02x}{g:02x}{b:02x}"


def name_for_hex(value: str) -> str:
    """
    Find the closest wearable colour name for a hex code.

    We compare in HSV (hue, saturation, value) rather than RGB, and weight hue
    most heavily. Reason: in plain RGB, a dark navy and a dark brown are
    numerically close even though nobody would confuse them. Hue separates them
    properly - and for greys, where hue is meaningless, we fall back to
    comparing brightness.
    """
    if not value:
        return ""

    try:
        r, g, b = hex_to_rgb(value)
    except (ValueError, IndexError):
        return ""

    h1, s1, v1 = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)

    best_name = ""
    best_distance = float("inf")

    for name, ref_hex in NAMED_COLORS:
        rr, rg, rb = hex_to_rgb(ref_hex)
        h2, s2, v2 = colorsys.rgb_to_hsv(rr / 255, rg / 255, rb / 255)

        # Hue is a circle: 0.99 and 0.01 are neighbours, not opposites
        hue_gap = abs(h1 - h2)
        hue_gap = min(hue_gap, 1 - hue_gap)

        if s1 < 0.12 and s2 < 0.12:
            # Both are effectively greyscale - only brightness matters
            distance = abs(v1 - v2)
        else:
            distance = (hue_gap * 2.2) ** 2 + (s1 - s2) ** 2 + (v1 - v2) ** 2

        if distance < best_distance:
            best_distance = distance
            best_name = name

    return best_name


def is_neutral(value: str) -> bool:
    """
    Neutrals (black, white, grey, beige, navy, denim) go with everything.

    Phase 4's harmony scoring needs this: pairing two bold colours is risky,
    but pairing anything with a neutral is always safe.
    """
    return name_for_hex(value) in {
        "Black", "Charcoal", "Grey", "Light Grey", "White", "Off White",
        "Cream", "Beige", "Tan", "Camel", "Navy", "Denim", "Khaki",
    }
