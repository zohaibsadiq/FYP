"""
The only file that knows which company generates the try-on pictures.

Pictures are made by the FASHN try-on model, run by fal.ai. A picture takes
from several seconds to about a minute, longer than a web request should wait,
so this offers two steps, submit and check, instead of one call that waits. The
rest of the app only ever deals in web addresses. vision/storage.py plays the
same role for Cloudinary.

fal.ai's queue: a picture is submitted to the model's own address, and its
status and result are read under the app's address (owner and app only, without
the version), as fal.ai documents for models with longer names.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

import requests
from django.conf import settings

logger = logging.getLogger(__name__)

MODEL = "fal-ai/fashn/tryon/v1.6"
APP = "fal-ai/fashn"
SUBMIT_URL = f"https://queue.fal.run/{MODEL}"
STATUS_URL = f"https://queue.fal.run/{APP}/requests/{{task_id}}/status"
RESULT_URL = f"https://queue.fal.run/{APP}/requests/{{task_id}}"

SUBMIT_TIMEOUT = 30
STATUS_TIMEOUT = 20

PROVIDER = "fal/fashn/tryon/v1.6"

# The model's garment category, by where the garment is worn. Anything not
# listed here, such as shoes or a watch, has no equivalent on the supplier's
# side and is refused before any money is spent.
CATEGORY = {
    "TOP": "tops",
    "OUTERWEAR": "tops",
    "BOTTOM": "bottoms",
    "FULL_BODY": "one-pieces",
}

# Words in the supplier's error that mean the photos were the problem, so the
# person is asked for a different photo rather than told to wait and retry.
PHOTO_PROBLEMS = ("pose", "image", "photo", "load", "moderation", "nsfw", "content", "person")


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
    return slot in CATEGORY


def _headers() -> dict[str, str]:
    return {"Authorization": f"Key {settings.TRYON_API_KEY}", "Content-Type": "application/json"}


def submit(body_photo_url: str, garment_image_url: str, slot: str) -> Submitted:
    """Queues one picture and returns the supplier's id for it."""
    if not is_configured():
        raise TryOnUnavailable("Try-On is not switched on yet.")

    category = CATEGORY.get(slot)
    if category is None:
        raise TryOnRefused("Only tops, bottoms, outerwear and full outfits can be drawn on.")

    payload = {
        "model_image": body_photo_url,
        "garment_image": garment_image_url,
        "category": category,
        # Slower than the default but keeps more of the garment's detail, such
        # as a kurta's collar and placket. The price is the same.
        "mode": "quality",
        "num_samples": 1,
        "output_format": "png",
    }

    try:
        response = requests.post(SUBMIT_URL, json=payload, headers=_headers(), timeout=SUBMIT_TIMEOUT)
    except requests.RequestException as exc:
        raise TryOnUnavailable("Could not reach the picture service.") from exc

    body = _as_json(response)

    if response.status_code in (401, 403):
        logger.error("Try-on submit refused the key: %s %s", response.status_code, _short(body))
        raise TryOnUnavailable("The picture service rejected the account key.")

    if response.status_code in (400, 422):
        # A badly formed request or a photo address the model cannot read.
        # Neither is worth trying again, and the sentence below is the only
        # thing the person ever sees.
        logger.warning("Try-on submit refused: %s", _short(body))
        raise TryOnRefused(
            "That pairing could not be used. A clear, full-length photo facing "
            "the camera works best."
        )

    task_id = body.get("request_id")
    if not response.ok or not task_id:
        logger.error("Try-on submit failed: %s %s", response.status_code, _short(body))
        raise TryOnUnavailable("The picture service did not accept the request.")

    return Submitted(task_id=task_id, provider=PROVIDER)


def check(task_id: str) -> Progress:
    """How far a queued picture has got. Never raises an error for one that is still running."""
    if not is_configured():
        raise TryOnUnavailable("Try-On is not switched on yet.")

    status_body = _get(STATUS_URL.format(task_id=task_id))
    if status_body is None:
        # The supplier has no record of this picture, so waiting will not help.
        return Progress(done=True, error="That picture was lost on the drawing service's side. Try again.")

    if (status_body.get("status") or "").upper() != "COMPLETED":
        return Progress(done=False)

    if status_body.get("error"):
        return _failed(task_id, status_body.get("error"), status_body.get("error_type"))

    result = _get(RESULT_URL.format(task_id=task_id), result=True)
    if result is None:
        return Progress(done=True, error="That picture was lost on the drawing service's side. Try again.")
    if result.get("detail") and not result.get("images"):
        return _failed(task_id, result.get("detail"), "")

    url = _first_image(result)
    if url:
        return Progress(done=True, image_url=url)
    logger.error("Try-on finished with no image: %s", _short(result))
    return Progress(done=True, error="The picture came back empty.")


def _get(url: str, result: bool = False) -> dict | None:
    """
    One read from the queue. A dropped connection or a fault on the supplier's
    side is reported as unavailable, so the picture simply keeps waiting; an
    unknown request comes back as None. A result that failed is returned as is,
    because fal.ai answers it with an error status and a detail message.
    """
    try:
        response = requests.get(url, headers=_headers(), timeout=STATUS_TIMEOUT)
    except requests.RequestException as exc:
        raise TryOnUnavailable("Could not reach the picture service.") from exc

    if response.status_code == 404:
        return None
    body = _as_json(response)
    if response.ok or (result and body.get("detail")):
        return body
    logger.warning("Try-on read failed: %s %s", response.status_code, _short(body))
    raise TryOnUnavailable("The picture service did not answer properly.")


def _failed(task_id: str, error, error_type) -> Progress:
    reason = _reason(error)
    logger.warning("Try-on request %s failed: %s, %s", task_id, error_type or "no type", reason or "no reason given")
    if any(word in reason.lower() for word in PHOTO_PROBLEMS):
        return Progress(done=True, error="That picture did not work. Try a different photo.")
    return Progress(
        done=True,
        error="The drawing service could not finish this one on its side. Try again in a little while.",
    )


def _reason(error) -> str:
    """fal.ai sends an error as a sentence, or as a list of {msg: ...} items."""
    if isinstance(error, str):
        return error.strip()
    if isinstance(error, list):
        return " ".join(str(item.get("msg", item)) if isinstance(item, dict) else str(item) for item in error)
    if isinstance(error, dict):
        return str(error.get("message") or error.get("msg") or error)
    return str(error or "")


def _first_image(data: dict) -> str:
    for image in data.get("images") or []:
        url = (image or {}).get("url")
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
