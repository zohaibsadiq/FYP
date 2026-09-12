from __future__ import annotations

import colorsys

# Deliberately short. The question a closet filter has to answer is "navy or
# black", not which of 16 million hex values a photo averaged out to.
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
    Closest name in NAMED_COLORS, matched in HSV with hue weighted heaviest.
    In RGB, #1b2f55 navy and #3d2314 chocolate sit close enough to swap names.
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

        # hue wraps at 1.0
        hue_gap = abs(h1 - h2)
        hue_gap = min(hue_gap, 1 - hue_gap)

        if s1 < 0.12 and s2 < 0.12:
            # colorsys returns an arbitrary hue below this saturation
            distance = abs(v1 - v2)
        else:
            distance = (hue_gap * 2.2) ** 2 + (s1 - s2) ** 2 + (v1 - v2) ** 2

        if distance < best_distance:
            best_distance = distance
            best_name = name

    return best_name


def is_neutral(value: str) -> bool:
    """Neutrals pair with anything, so harmony scoring treats them as always safe."""
    return name_for_hex(value) in {
        "Black", "Charcoal", "Grey", "Light Grey", "White", "Off White",
        "Cream", "Beige", "Tan", "Camel", "Navy", "Denim", "Khaki",
    }
