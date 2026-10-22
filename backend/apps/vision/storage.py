"""
The only file that talks to Cloudinary, the image host. Every upload and delete
goes through here, so changing hosts would mean changing one file.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import IO, Any

import cloudinary
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
    """
    Raised when the keys are missing from .env, with a message that names them,
    instead of a confusing error from deep inside the Cloudinary library.
    """


def is_configured() -> bool:
    return all(settings.CLOUDINARY.values())


def _require_config() -> None:
    if not is_configured():
        raise CloudinaryNotConfigured(
            "Cloudinary keys are missing. Add CLOUDINARY_CLOUD_NAME, "
            "CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET to backend/.env"
        )


# Folder names inside the Cloudinary account. Anything that belongs to one
# person also gets a /u<id> part from folder_for(), so account 42's clothes
# live under garments/clean/u42/.
class Folder:
    GARMENT_ORIGINAL = "garments/original"
    GARMENT_CLEAN = "garments/clean"         # the photo after background removal
    BODY_PHOTO = "users/body"
    TRY_ON_RESULT = "tryon/results"


@dataclass(frozen=True)
class UploadedImage:
    """
    The web address is for showing the picture. The public id is for deleting it
    later, because Cloudinary deletes by id, not by address.
    """

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
    # The browser sends back a picture id that the upload endpoint gave it
    # earlier. The folder at the start of that id is the only proof that the
    # file belongs to this account: garments/clean/u42/abc123 is account 42's.
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
    Sends one picture to Cloudinary and returns where it landed.

    file:      an open file, raw bytes, or a path on disk.
    folder:    one of the names in Folder, such as Folder.GARMENT_CLEAN.
    user_id:   puts the file in that account's own sub-folder.
    public_id: a fixed name, for files that replace an earlier version, such
               as a body photo. Left out, Cloudinary picks a unique name.
    tags:      labels that make bulk deletion possible later.
    overwrite: only means anything together with public_id.

    Raises CloudinaryNotConfigured if the keys are missing from .env.
    """
    _require_config()

    full_folder = folder_for(folder, user_id)

    options: dict[str, Any] = {
        "folder": full_folder,
        "resource_type": "image",
        # Strips the hidden data phones add to photos, such as GPS location
        # and camera model, from the stored copy.
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
    """
    True if deleted, or if it was already gone. Never raises an error: a failed
    cleanup must not break the request that asked for it.
    """
    if not is_configured() or not public_id:
        return False

    try:
        result = cloudinary.uploader.destroy(public_id, invalidate=True)
        return result.get("result") in {"ok", "not found"}
    except Exception:
        logger.exception("Could not delete Cloudinary image %s", public_id)
        return False

