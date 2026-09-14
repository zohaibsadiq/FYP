"""
rembg fetches the u2net weights (~176 MB) on first use and caches them on disk,
so the first cutout after a clean install is slow and needs network access.
"""

from __future__ import annotations

import io
import logging
import time
from dataclasses import dataclass

from PIL import Image

logger = logging.getLogger(__name__)

# Past this, a cutout costs seconds more for detail a grid tile discards.
MAX_DIMENSION = 1600

_session = None


def _get_session():
    # Lazy: at import, every manage.py command would pay for the weights.
    global _session
    if _session is None:
        from rembg import new_session

        logger.info("Loading u2net background-removal model (first run downloads ~176 MB)...")
        _session = new_session("u2net")
        logger.info("Background-removal model ready.")
    return _session


@dataclass(frozen=True)
class CutoutResult:
    png_bytes: bytes
    width: int
    height: int
    duration_ms: int           # wall clock for one cutout
    dominant_hex: str          # e.g. "#1b2f55"
    coverage: float            # 0-1 share of the frame the garment fills

    @property
    def looks_empty(self) -> bool:
        """Almost nothing detected: a blurry photo, or a white top on a white sheet."""
        return self.coverage < 0.02


def remove_background(image_bytes: bytes) -> CutoutResult:
    """
    Raw uploaded bytes in, transparent PNG out.

    Raises:
        ValueError: if the file is not a readable image.
    """
    started = time.perf_counter()

    try:
        source = Image.open(io.BytesIO(image_bytes))
        source.load()
    except Exception as exc:
        raise ValueError("That file is not a readable image.") from exc

    # Phones record rotation as an EXIF tag rather than rotating the pixels, and
    # rembg reads pixels. Without the transpose, shirts come out sideways.
    try:
        from PIL import ImageOps

        source = ImageOps.exif_transpose(source)
    except Exception:  # no EXIF block, or an unreadable one
        pass

    cutout = cut_out_subject(source.convert("RGB"))

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


def cut_out_subject(source: Image.Image) -> Image.Image:
    """
    The subject of a photograph on a transparent background, cropped to fit.

    Shared so that one piece of code decides what counts as the subject,
    whether the photo is of one garment or of somebody wearing several.
    """
    from rembg import remove

    cutout = remove(_downscale(source, MAX_DIMENSION), session=_get_session())
    if cutout.mode != "RGBA":
        cutout = cutout.convert("RGBA")
    return _crop_to_subject(cutout)


def _downscale(image: Image.Image, max_side: int) -> Image.Image:
    if max(image.size) <= max_side:
        return image
    ratio = max_side / max(image.size)
    new_size = (round(image.width * ratio), round(image.height * ratio))
    return image.resize(new_size, Image.LANCZOS)


def _crop_to_subject(image: Image.Image, padding: int = 12) -> Image.Image:
    """Trim the transparent margin so every garment fills its grid tile the same way."""
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
    """Returns ("#rrggbb", coverage 0-1) over the opaque pixels only."""
    small = image.copy()
    small.thumbnail((sample_size, sample_size), Image.LANCZOS)
    pixels = list(small.getdata())

    opaque = [(r, g, b) for r, g, b, a in pixels if a > 200]
    coverage = len(opaque) / len(pixels) if pixels else 0.0

    if not opaque:
        return "", 0.0

    # Fabric in shadow and blown-out highlights carry no usable hue, and there
    # are enough of both on a folded garment to drag the mean toward grey.
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
