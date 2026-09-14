"""
Reading an outfit out of a photograph.

There is no trained clothing classifier here, and the code does not pretend
otherwise. The subject is cut out of its background, split by height into the
places clothes sit on a standing body, and the dominant colour of each band is
measured. That is enough to answer "what colours is this outfit, roughly
where", which is the question a closet match actually needs.

Where the guess is weak the result says so, rather than handing back a number
as though it were a fact.
"""

from __future__ import annotations

import io
import logging
from dataclasses import dataclass

from PIL import Image, ImageOps

from .colors import distance, name_for_hex

logger = logging.getLogger(__name__)

# Where each kind of clothing sits on a standing body, as a share of the
# subject's height from the top down. They leave gaps at the joins because a
# hem and a waistband overlap, and reading across the join muddies both.
#
# Nothing is read above the shoulders. The top of a photograph of a person is
# their face and hair, and reporting that as a beige cap is worse than saying
# nothing about hats at all.
BANDS: list[tuple[str, float, float]] = [
    ("TOP", 0.18, 0.48),
    ("BOTTOM", 0.53, 0.86),
    ("FOOTWEAR", 0.90, 1.00),
]

# A band emptier than this is background showing through, not a garment.
MIN_BAND_COVERAGE = 0.15

# Bands closer than this are the same piece of cloth, which is what a photo of
# one shirt looks like once it has been sliced into three. Measured: slices of
# one garment come back 0 to 2 apart, and three separate garments 60 apart. A
# person starts to see a difference at about 2.3.
SAME_CLOTH = 4.0

# Under this the picture is too small to read anything useful from.
MIN_SIDE = 80

# Below this the subject is wider than it is tall, so it is a flat garment on a
# bed rather than somebody standing up, and the bands mean nothing.
FULL_LENGTH_RATIO = 1.35


class LookUnreadable(Exception):
    """Carries a sentence that can be shown to the reader unchanged."""

    def __init__(self, reason: str, code: str):
        super().__init__(reason)
        self.reason = reason
        self.code = code


@dataclass(frozen=True)
class Region:
    slot: str
    hex: str
    color_name: str
    coverage: float          # 0-1 share of the band that is really garment

    def as_dict(self) -> dict:
        return {
            "slot": self.slot,
            "hex": self.hex,
            "color_name": self.color_name,
            "coverage": round(self.coverage, 3),
        }


@dataclass(frozen=True)
class Look:
    regions: list[Region]
    width: int
    height: int
    is_full_length: bool
    one_garment_only: bool
    duration_ms: int

    @property
    def note(self) -> str:
        """What the reader should know about how much to trust this."""
        if self.one_garment_only:
            return (
                "This looks like one piece of clothing rather than a whole outfit, "
                "so it has been read as a single item."
            )
        if not self.is_full_length:
            return (
                "The picture is not full length, so only part of the outfit could "
                "be read. A photo from head to feet works best."
            )
        return "Read from head to feet."

    def as_dict(self) -> dict:
        return {
            "regions": [region.as_dict() for region in self.regions],
            "is_full_length": self.is_full_length,
            "one_garment_only": self.one_garment_only,
            "note": self.note,
        }


def _band_colour(cutout: Image.Image, top: int, bottom: int) -> tuple[str, float]:
    """Dominant colour of one horizontal slice, over its opaque pixels only."""
    band = cutout.crop((0, top, cutout.width, bottom))
    if band.width == 0 or band.height == 0:
        return "", 0.0

    small = band.copy()
    small.thumbnail((96, 96), Image.LANCZOS)
    pixels = list(small.getdata())
    if not pixels:
        return "", 0.0

    opaque = [(r, g, b) for r, g, b, a in pixels if a > 200]
    coverage = len(opaque) / len(pixels)
    if not opaque:
        return "", 0.0

    # Deep shadow and blown-out highlight carry no usable hue, and a photo of a
    # person has plenty of both.
    mid = [(r, g, b) for r, g, b in opaque if 18 < (r + g + b) / 3 < 240]
    sample = mid or opaque

    count = len(sample)
    r = sum(p[0] for p in sample) // count
    g = sum(p[1] for p in sample) // count
    b = sum(p[2] for p in sample) // count
    return f"#{r:02x}{g:02x}{b:02x}", coverage


def read(image_bytes: bytes) -> Look:
    """
    Raw uploaded bytes in, one colour per part of the outfit out.

    Raises:
        LookUnreadable: with a reason already written for the reader.
    """
    import time

    started = time.perf_counter()

    try:
        source = Image.open(io.BytesIO(image_bytes))
        source.load()
    except Exception as exc:
        raise LookUnreadable("That file is not a picture we can read.", "unreadable") from exc

    try:
        source = ImageOps.exif_transpose(source)
    except Exception:      # no EXIF block, or an unreadable one
        pass

    source = source.convert("RGB")
    if min(source.size) < MIN_SIDE:
        raise LookUnreadable(
            "That picture is too small to read. Try a larger one.", "too_small"
        )

    # The same cutout the closet uses, so one piece of code decides what counts
    # as the subject of a photograph.
    from apps.vision.background import cut_out_subject

    cutout = cut_out_subject(source)

    if cutout.width == 0 or cutout.height == 0:
        raise LookUnreadable(
            "Nothing stood out from the background. Try a picture with the "
            "person or the clothes filling more of the frame.",
            "no_subject",
        )

    is_full_length = cutout.height >= cutout.width * FULL_LENGTH_RATIO

    found: list[Region] = []
    for slot, start, end in BANDS:
        top = int(cutout.height * start)
        bottom = max(top + 1, int(cutout.height * end))
        hex_value, coverage = _band_colour(cutout, top, bottom)
        if not hex_value or coverage < MIN_BAND_COVERAGE:
            continue
        found.append(Region(slot, hex_value, name_for_hex(hex_value), coverage))

    if not found:
        raise LookUnreadable(
            "No clothes could be made out in that picture. Try one with better "
            "light, or the outfit filling more of the frame.",
            "nothing_found",
        )

    # Four slices of one shirt come back as four near-identical colours. Saying
    # "your hat should be blue" off a photo of a shirt would be nonsense.
    one_garment_only = (
        not is_full_length
        and len(found) > 1
        and all(distance(found[0].hex, region.hex) < SAME_CLOTH for region in found[1:])
    )
    if one_garment_only:
        best = max(found, key=lambda region: region.coverage)
        found = [Region("", best.hex, best.color_name, best.coverage)]

    duration_ms = int((time.perf_counter() - started) * 1000)
    logger.info(
        "Look read in %d ms, %d region(s), full length: %s",
        duration_ms, len(found), is_full_length,
    )

    return Look(
        regions=found,
        width=cutout.width,
        height=cutout.height,
        is_full_length=is_full_length,
        one_garment_only=one_garment_only,
        duration_ms=duration_ms,
    )
