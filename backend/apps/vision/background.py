"""
Background removal, and the colour detection that piggybacks on it.

Turns a phone photo taken on a messy bed into a clean, studio-style cutout with
a transparent background - which is what makes the closet grid look like a real
product instead of a photo album.

How it works underneath:
`rembg` runs a pre-trained neural network called U2-Net. It outputs a mask -
one value per pixel saying "garment" or "not garment" - and we use that mask as
the image's alpha channel. We do NOT train anything; the model is already
trained on a large salient-object-detection dataset.

The model file (~176 MB) downloads by itself the first time and is then cached
on disk, so only the very first run is slow.
"""

from __future__ import annotations

import io
import logging
import time
from dataclasses import dataclass

from PIL import Image

logger = logging.getLogger(__name__)

# Photos from phones are huge (4000px+). Anything past this adds seconds of
# processing for no visible benefit once it is displayed in a grid.
MAX_DIMENSION = 1600

# The model is loaded once and kept in memory. Loading it per request would add
# several seconds to every upload.
_session = None


def _get_session():
    """
    Create the rembg session on first use, not at import time.

    This matters: if we loaded the model at import, `manage.py migrate` and even
    `manage.py check` would sit there loading 176 MB of neural network for no
    reason.
    """
    global _session
    if _session is None:
        from rembg import new_session

        logger.info("Loading u2net background-removal model (first run downloads ~176 MB)...")
        _session = new_session("u2net")
        logger.info("Background-removal model ready.")
    return _session


@dataclass(frozen=True)
class CutoutResult:
    """What we get back from processing one photo."""

    png_bytes: bytes           # transparent PNG, ready to upload
    width: int
    height: int
    duration_ms: int           # measured, and reported in the thesis
    dominant_hex: str          # e.g. "#1b2f55"
    coverage: float            # 0-1: how much of the frame the garment fills

    @property
    def looks_empty(self) -> bool:
        """
        Almost nothing was detected. Usually means a blurry photo, or a white
        shirt on a white bedsheet. We warn the user rather than silently saving
        a blank image.
        """
        return self.coverage < 0.02


def remove_background(image_bytes: bytes) -> CutoutResult:
    """
    Main entry point. Give it the raw uploaded file, get back a clean PNG.

    Raises:
        ValueError: if the file is not a readable image.
    """
    started = time.perf_counter()

    try:
        source = Image.open(io.BytesIO(image_bytes))
        source.load()
    except Exception as exc:
        raise ValueError("That file is not a readable image.") from exc

    # EXIF rotation: phone photos often carry "rotate 90 degrees" as metadata
    # rather than in the pixels. Without this, shirts come out sideways.
    try:
        from PIL import ImageOps

        source = ImageOps.exif_transpose(source)
    except Exception:  # very old or unusual files
        pass

    source = source.convert("RGB")
    source = _downscale(source, MAX_DIMENSION)

    from rembg import remove

    cutout = remove(source, session=_get_session())
    if cutout.mode != "RGBA":
        cutout = cutout.convert("RGBA")

    cutout = _crop_to_subject(cutout)

    buffer = io.BytesIO()
    cutout.save(buffer, format="PNG", optimize=True)

    dominant_hex, coverage = _analyse_colour(cutout)
    duration_ms = int((time.perf_counter() - started) * 1000)

    logger.info("Background removed in %d ms (%dx%d)", duration_ms, cutout.width, cutout.height)

    return CutoutResult(
        png_bytes=buffer.getvalue(),
        width=cutout.width,
        height=cutout.height,
        duration_ms=duration_ms,
        dominant_hex=dominant_hex,
        coverage=coverage,
    )


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _downscale(image: Image.Image, max_side: int) -> Image.Image:
    if max(image.size) <= max_side:
        return image
    ratio = max_side / max(image.size)
    new_size = (round(image.width * ratio), round(image.height * ratio))
    return image.resize(new_size, Image.LANCZOS)


def _crop_to_subject(image: Image.Image, padding: int = 12) -> Image.Image:
    """
    Trim the empty transparent space around the garment.

    Without this, a shirt photographed from far away stays a small object
    floating in a big empty rectangle, and the closet grid looks inconsistent.
    getbbox() finds the bounding box of everything that is not fully transparent.
    """
    bbox = image.getbbox()
    if not bbox:
        return image

    left, top, right, bottom = bbox
    left = max(0, left - padding)
    top = max(0, top - padding)
    right = min(image.width, right + padding)
    bottom = min(image.height, bottom + padding)
    return image.crop((left, top, right, bottom))


def _analyse_colour(image: Image.Image, sample_size: int = 120) -> tuple[str, float]:
    """
    Find the garment's main colour, ignoring the transparent background.

    Method: shrink the image (so we look at ~14k pixels instead of millions),
    throw away anything transparent or nearly so, then average what is left in
    a way that ignores near-black and near-white shadow/highlight pixels which
    would otherwise drag every colour toward grey.

    This is deliberately simple. Phase 4's colour-harmony rules need a single
    representative colour per garment, not a full palette.

    Returns: ("#rrggbb", coverage 0-1)
    """
    small = image.copy()
    small.thumbnail((sample_size, sample_size), Image.LANCZOS)
    pixels = list(small.getdata())

    opaque = [(r, g, b) for r, g, b, a in pixels if a > 200]
    coverage = len(opaque) / len(pixels) if pixels else 0.0

    if not opaque:
        return "", 0.0

    # Drop shadows and blown-out highlights before averaging
    mid = [
        (r, g, b)
        for r, g, b in opaque
        if 18 < (r + g + b) / 3 < 240
    ]
    sample = mid or opaque

    n = len(sample)
    r = sum(p[0] for p in sample) // n
    g = sum(p[1] for p in sample) // n
    b = sum(p[2] for p in sample) // n

    return f"#{r:02x}{g:02x}{b:02x}", round(coverage, 3)
