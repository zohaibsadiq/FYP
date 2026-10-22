"""
Every endpoint that accepts a photo checks it here, so a file refused by one is
refused by all of them with the same message.
"""

from __future__ import annotations

from rest_framework.exceptions import ValidationError

MAX_UPLOAD_BYTES = 12 * 1024 * 1024

ALLOWED_IMAGE_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/heic",
    "image/heif",
}


def read_upload(request, field: str = "image") -> bytes:
    """
    The bytes of an uploaded photo, or a clear error saying what is wrong.

    Size and type are checked before the file is read, so a huge upload is
    refused before any work is done on it.
    """
    upload = request.FILES.get(field)
    if not upload:
        raise ValidationError({field: f"No file was sent under the key '{field}'."})

    if upload.size > MAX_UPLOAD_BYTES:
        megabytes = upload.size / 1024 / 1024
        raise ValidationError(
            {field: f"That image is {megabytes:.0f} MB. The limit is 12 MB."}
        )

    content_type = (upload.content_type or "").lower()
    if content_type not in ALLOWED_IMAGE_TYPES:
        raise ValidationError(
            {field: f"'{content_type}' is not a supported image type. Use JPG, PNG or WebP."}
        )

    return upload.read()
