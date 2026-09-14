"""Reading an outfit out of a photograph and matching it to the closet."""

from __future__ import annotations

import base64
import io
import logging

from drf_spectacular.utils import extend_schema
from PIL import Image
from rest_framework.exceptions import ValidationError
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.vision.uploads import read_upload
from apps.wardrobe.models import Category
from apps.wardrobe.serializers import GarmentItemListSerializer

from . import matching
from .look import LookUnreadable, read
from .serializers import LookResultSerializer, LookUploadSerializer

logger = logging.getLogger(__name__)

# Wide enough to recognise the outfit, small enough to sit in a JSON response.
PREVIEW_WIDTH = 320


def _preview(width: int, height: int, image_bytes: bytes) -> str:
    """
    The uploaded photo as a small data URI, so the screen can show what was
    read without anything being stored. Nothing about a look someone is only
    trying out belongs in permanent storage.
    """
    try:
        source = Image.open(io.BytesIO(image_bytes))
        source.load()
        source = source.convert("RGB")
        source.thumbnail((PREVIEW_WIDTH, PREVIEW_WIDTH * 3), Image.LANCZOS)
        buffer = io.BytesIO()
        source.save(buffer, "JPEG", quality=72, optimize=True)
        return "data:image/jpeg;base64," + base64.b64encode(buffer.getvalue()).decode()
    except Exception:
        logger.warning("Could not build a preview for the uploaded look", exc_info=True)
        return ""


@extend_schema(
    tags=["Intelligence"],
    summary="Read an outfit out of a photo and find the nearest things you own",
    description=(
        "Send one image as multipart/form-data under the key `image`.\n\n"
        "The subject is cut out of its background, split by height into the "
        "places clothes sit on a standing body, and the dominant colour of each "
        "part is measured. Those colours are then matched against the closet.\n\n"
        "Matching is on colour and position only. Fabric, cut and pattern are "
        "not read from the photograph, so they are not claimed.\n\n"
        "A photo that cannot be read answers 200 with `reason` filled in rather "
        "than an error status: a blurry picture is not a fault."
    ),
    request=LookUploadSerializer,
    responses=LookResultSerializer,
)
class CopyLookView(APIView):
    parser_classes = [MultiPartParser, FormParser]
    serializer_class = LookUploadSerializer

    def post(self, request):
        raw = read_upload(request)

        try:
            look = read(raw)
        except LookUnreadable as exc:
            return Response({
                "parts": [],
                "how_close": 0,
                "verdict": "",
                "note": exc.reason,
                "code": exc.code,
                "is_full_length": False,
                "one_garment_only": False,
                "preview": _preview(0, 0, raw),
            })
        except Exception as exc:                       # model failure, corrupt file
            logger.exception("Reading a look failed")
            raise ValidationError(
                {"image": "That picture could not be read. Try another one."}
            ) from exc

        parts = []
        best_scores = []
        for region in look.regions:
            found = matching.nearest(request.user, region.slot, region.hex)
            best = found[0].score if found else 0
            best_scores.append(best)

            parts.append({
                "slot": region.slot,
                "slot_label": Category.Slot(region.slot).label if region.slot else "This item",
                "hex": region.hex,
                "color_name": region.color_name,
                "best_score": best,
                "missing": not found,
                "matches": [
                    {
                        "item": GarmentItemListSerializer(
                            match.item, context={"request": request}
                        ).data,
                        "score": match.score,
                        "verdict": match.verdict,
                    }
                    for match in found
                ],
            })

        overall = matching.how_close(best_scores)

        return Response({
            "parts": parts,
            "how_close": overall,
            "verdict": matching.verdict_for(overall),
            "note": look.note,
            "code": "",
            "is_full_length": look.is_full_length,
            "one_garment_only": look.one_garment_only,
            "preview": _preview(look.width, look.height, raw),
        })
