"""
The only file that knows which company generates the try-on pictures.

Generation takes two to four minutes, far longer than a web request can stay
open, so this offers two steps, submit and check, instead of one call that
waits. The rest of the app only ever deals in web addresses. vision/storage.py
plays the same role for Cloudinary.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

import requests
from django.conf import settings

logger = logging.getLogger(__name__)

SUBMIT_URL = "https://api.piapi.ai/api/v1/task"
STATUS_URL = "https://api.piapi.ai/api/v1/task/{task_id}"

SUBMIT_TIMEOUT = 30
STATUS_TIMEOUT = 20

PROVIDER = "piapi/kling/ai_try_on"

# Which of the supplier's inputs a garment goes into, by where it is worn.
# Anything not listed here, such as shoes or a watch, has no equivalent on the
# supplier's side and is refused before any money is spent.
GARMENT_FIELD = {
    "TOP": "upper_input",
    "OUTERWEAR": "upper_input",
    "BOTTOM": "lower_input",
    "FULL_BODY": "dress_input",
}


class TryOnUnavailable(RuntimeError):
    """No key configured, or the supplier could not be reached."""


class TryOnRefused(ValueError):
    """The supplier will not accept this pairing. Retrying will not help."""


@dataclass(frozen=True)
class Submitted:
    task_id: str
    provider: str


@dataclass(frozen=True)
class Progress:
    done: bool
    image_url: str = ""
    error: str = ""


def is_configured() -> bool:
    return bool(settings.TRYON_API_KEY)


def supports(slot: str) -> bool:
    return slot in GARMENT_FIELD


def _headers() -> dict[str, str]:
    return {"x-api-key": settings.TRYON_API_KEY, "Content-Type": "application/json"}


def submit(body_photo_url: str, garment_image_url: str, slot: str) -> Submitted:
    """
    Queues one picture and returns the supplier's id for it.

    batch_size is always sent, although the supplier's documentation calls it
    optional with a default of 1. Leaving it out is rejected with a bare
    "Invalid input" that names no field.
    """
    if not is_configured():
        raise TryOnUnavailable("Try-On is not switched on yet.")

    field = GARMENT_FIELD.get(slot)
    if field is None:
        raise TryOnRefused("Only tops, bottoms, outerwear and full outfits can be drawn on.")

    payload = {
        "model": "kling",
        "task_type": "ai_try_on",
        "input": {"model_input": body_photo_url, field: garment_image_url, "batch_size": 1},
    }

    try:
        response = requests.post(
            SUBMIT_URL, json=payload, headers=_headers(), timeout=SUBMIT_TIMEOUT
        )
    except requests.RequestException as exc:
        raise TryOnUnavailable("Could not reach the picture service.") from exc

    if response.status_code == 401:
        raise TryOnUnavailable("The picture service rejected the account key.")

    body = _as_json(response)
    task_id = (body.get("data") or {}).get("task_id")

    if response.status_code == 400:
        # A 400 covers both a badly formed request and a photo the model cannot
        # work with. Neither is worth trying again, and the sentence below is
        # the only thing the person ever sees.
        logger.warning("Try-on submit refused: %s", _short(body))
        raise TryOnRefused(
            "That pairing could not be used. A clear, full-length photo facing "
            "the camera works best."
        )

    if not response.ok or not task_id:
        logger.error("Try-on submit failed: %s %s", response.status_code, _short(body))
        raise TryOnUnavailable("The picture service did not accept the request.")

    return Submitted(task_id=task_id, provider=PROVIDER)


def check(task_id: str) -> Progress:
    """How far a queued picture has got. Never raises an error for one that is still running."""
    if not is_configured():
        raise TryOnUnavailable("Try-On is not switched on yet.")

    try:
        response = requests.get(
            STATUS_URL.format(task_id=task_id), headers=_headers(), timeout=STATUS_TIMEOUT
        )
    except requests.RequestException as exc:
        raise TryOnUnavailable("Could not reach the picture service.") from exc

    data = (_as_json(response).get("data") or {})
    status = (data.get("status") or "").lower()

    if status == "completed":
        url = _first_image(data)
        if url:
            return Progress(done=True, image_url=url)
        logger.error("Try-on finished with no image: %s", _short(data))
        return Progress(done=True, error="The picture came back empty.")

    if status == "failed":
        error = data.get("error") or {}
        reason = (error.get("message") or "").strip()
        logger.warning(
            "Try-on task %s failed: code %s, %s", task_id, error.get("code"), reason or "no reason given"
        )
        if _service_fault(error):
            # Kling gave up on its own side, after processing for its full
            # time allowance. The photos were never the problem, so the
            # sentence must not send anybody off to take a new one.
            return Progress(
                done=True,
                error=(
                    "The drawing service could not finish this one on its side. "
                    "Try again in a little while."
                ),
            )
        return Progress(done=True, error="That picture did not work. Try a different photo.")

    return Progress(done=False)


def _service_fault(error: dict) -> bool:
    """
    True when the supplier reports trouble of its own rather than with the
    pictures. Code 10000 "Internal error." is what it sends when a picture
    times out on its side; nothing is charged for those.
    """
    message = (error.get("message") or "").lower()
    return error.get("code") == 10000 or "internal error" in message


def _first_image(data: dict) -> str:
    works = ((data.get("output") or {}).get("works")) or []
    for work in works:
        image = work.get("image") or {}
        url = image.get("resource_without_watermark") or image.get("resource")
        if url:
            return url
    return ""


def _as_json(response: requests.Response) -> dict:
    try:
        body = response.json()
    except ValueError:
        return {}
    return body if isinstance(body, dict) else {}


def _short(body) -> str:
    return str(body)[:300]
