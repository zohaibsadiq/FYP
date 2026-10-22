from __future__ import annotations

from functools import lru_cache

# Kept short on purpose. A closet filter needs to answer "navy or black?", not
# which of 16 million colour codes a photo averaged out to.
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


# The reference white that screen colours are measured against, known as D65.
_WHITE = (0.95047, 1.0, 1.08883)


@lru_cache(maxsize=2048)
def _lab(value: str) -> tuple[float, float, float] | None:
    """
    Turns a screen colour code like "#1b2f55" into Lab, a way of writing
    colours that matches how people see them.

    Plain colour codes do not: two blues far apart in code can look almost the
    same, and two greys close together in code can look clearly different. In
    Lab, the gap between two colours is roughly the difference a person would
    notice.

    The answer is remembered once worked out. Comparing a closet against a page
    of shop prices asks about the same few hundred colours again and again.
    """
    try:
        r, g, b = hex_to_rgb(value)
    except (ValueError, IndexError):
        return None

    def straighten(channel: float) -> float:
        # Screens store brightness on a curve. The maths below needs it on a
        # straight line.
        channel /= 255
        return channel / 12.92 if channel <= 0.04045 else ((channel + 0.055) / 1.055) ** 2.4

    r, g, b = straighten(r), straighten(g), straighten(b)

    x = r * 0.4124 + g * 0.3576 + b * 0.1805
    y = r * 0.2126 + g * 0.7152 + b * 0.0722
    z = r * 0.0193 + g * 0.1192 + b * 0.9505

    def curve(t: float) -> float:
        return t ** (1 / 3) if t > 0.008856 else (7.787 * t) + 16 / 116

    fx, fy, fz = (curve(c / w) for c, w in zip((x, y, z), _WHITE))
    return 116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)


def distance(a: str, b: str) -> float:
    """
    How far apart two colours look. 0 is the same colour, and about 100 is as
    far apart as two colours get.
    """
    first, second = _lab(a), _lab(b)
    if first is None or second is None:
        return float("inf")
    return sum((p - q) ** 2 for p, q in zip(first, second)) ** 0.5


def name_for_hex(value: str) -> str:
    """Closest name in NAMED_COLORS."""
    if not value or _lab(value) is None:
        return ""

    best_name = ""
    best_distance = float("inf")
    for name, ref_hex in NAMED_COLORS:
        gap = distance(value, ref_hex)
        if gap < best_distance:
            best_distance = gap
            best_name = name

    return best_name

