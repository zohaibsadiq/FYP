"""Single choke point for Cloudinary. No other module calls the SDK directly."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import IO, Any

import cloudinary
import cloudinary.api
import cloudinary.uploader
from django.conf import settings

logger = logging.getLogger(__name__)


cloudinary.config(
    cloud_name=settings.CLOUDINARY["cloud_name"],
    api_key=settings.CLOUDINARY["api_key"],
    api_secret=settings.CLOUDINARY["api_secret"],
    secure=True,
)


class CloudinaryNotConfigured(RuntimeError):
    """Raised when the .env keys are missing, in place of an opaque SDK error."""


def is_configured() -> bool:
    return all(settings.CLOUDINARY.values())


def _require_config() -> None:
    if not is_configured():
        raise CloudinaryNotConfigured(
            "Cloudinary keys are missing. Add CLOUDINARY_CLOUD_NAME, "
            "CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET to backend/.env"
        )


# Paths are relative to CLOUDINARY_ROOT_FOLDER and, for anything owned by a
# single account, gain a /u<id> segment from folder_for().
class Folder:
    GARMENT_ORIGINAL = "garments/original"
    GARMENT_CLEAN = "garments/clean"         # output of the rembg cutout
    BODY_PHOTO = "users/body"
    TRY_ON_RESULT = "tryon/results"
    INSPIRATION = "inspiration"              # "Steal the Look" uploads


@dataclass(frozen=True)
class UploadedImage:
    """public_id is stored beside the URL because deletion needs the id, not the URL."""

    url: str
    public_id: str
    width: int
    height: int
    bytes: int
    format: str

    @property
    def size_kb(self) -> int:
        return round(self.bytes / 1024)


def folder_for(folder: str, user_id: int | None) -> str:
    base = f"{settings.CLOUDINARY_ROOT_FOLDER}/{folder}"
    return f"{base}/u{user_id}" if user_id else base


def owns_public_id(public_id: str, folder: str, user_id: int) -> bool:
    # A client posts back a public_id the upload endpoint handed it, so the
    # folder prefix is the only evidence that the file is that account's own.
    if not public_id:
        return False
    return public_id.startswith(f"{folder_for(folder, user_id)}/")


def upload_image(
    file: IO[bytes] | bytes | str,
    folder: str,
    *,
    user_id: int | None = None,
    public_id: str | None = None,
    tags: list[str] | None = None,
    overwrite: bool = False,
) -> UploadedImage:
    """
    Send one image to Cloudinary and return where it landed.

    Args:
        file:      an open file, raw bytes, or a local path.
        folder:    a constant from `Folder`, e.g. Folder.GARMENT_CLEAN.
        user_id:   puts the file in that account's own subfolder.
        public_id: a fixed name, for files that replace an earlier version such
                   as a body photo. Left out, Cloudinary picks a unique name.
        tags:      queried later for bulk deletion.
        overwrite: only meaningful together with public_id.

    Raises:
        CloudinaryNotConfigured: if the .env keys are missing.
    """
    _require_config()

    full_folder = folder_for(folder, user_id)

    options: dict[str, Any] = {
        "folder": full_folder,
        "resource_type": "image",
        # Drops EXIF GPS and camera fields from the stored copy.
        "image_metadata": False,
        "invalidate": True,
    }
    if public_id:
        options["public_id"] = public_id
        options["overwrite"] = overwrite
    if tags:
        options["tags"] = tags

    result = cloudinary.uploader.upload(file, **options)

    logger.info(
        "Uploaded image to Cloudinary: %s (%s KB)",
        result["public_id"],
        round(result.get("bytes", 0) / 1024),
    )

    return UploadedImage(
        url=result["secure_url"],
        public_id=result["public_id"],
        width=result.get("width", 0),
        height=result.get("height", 0),
        bytes=result.get("bytes", 0),
        format=result.get("format", ""),
    )


def delete_image(public_id: str) -> bool:
    """True if deleted or already gone. Never raises; cleanup cannot fail a request."""
    if not is_configured() or not public_id:
        return False

    try:
        result = cloudinary.uploader.destroy(public_id, invalidate=True)
        return result.get("result") in {"ok", "not found"}
    except Exception:
        logger.exception("Could not delete Cloudinary image %s", public_id)
        return False


def thumbnail_url(url: str, width: int = 400) -> str:
    """
    Cloudinary derives a resize from transformation segments in the path itself,
    so no second upload and no stored variant are involved.

        .../upload/v123/closette/garments/clean/shirt.png
        .../upload/c_limit,w_400,f_auto,q_auto/v123/closette/.../shirt.png
    """
    marker = "/upload/"
    if marker not in url:
        return url
    head, tail = url.split(marker, 1)
    return f"{head}{marker}c_limit,w_{width},f_auto,q_auto/{tail}"


def ping() -> dict[str, Any]:
    _require_config()
    return cloudinary.api.ping()
