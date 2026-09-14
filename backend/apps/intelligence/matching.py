"""
Finding the nearest thing in somebody's own closet to a colour they liked.

Matching is on colour and on where the garment sits, nothing else. Fabric,
cut and pattern are not read from the photograph, so they are not claimed.
"""

from __future__ import annotations

from dataclasses import dataclass

from apps.wardrobe.models import Category, GarmentItem

from .colors import closeness

# A shalwar kameez, a dress or a jumpsuit covers the top and the bottom at
# once, so it answers either half of a look.
COVERS_BOTH = Category.Slot.FULL_BODY

# What a percentage means in words. A reader should not have to decide for
# themselves whether 62 is good.
VERDICTS = [
    (85, "Almost the same"),
    (70, "Very close"),
    (55, "Close enough"),
    (35, "A bit different"),
    (0, "Not really a match"),
]

# Below this, offering the item at all is misleading.
WORTH_SHOWING = 30

PER_REGION = 4


def verdict_for(score: int) -> str:
    for floor, words in VERDICTS:
        if score >= floor:
            return words
    return VERDICTS[-1][1]


@dataclass(frozen=True)
class Match:
    item: GarmentItem
    score: int

    @property
    def verdict(self) -> str:
        return verdict_for(self.score)


def candidates(owner, slot: str):
    """
    Wearable things that could stand in for this part of a look.

    Anything in the wash is left out: suggesting a shirt somebody cannot put
    on today is a worse answer than suggesting nothing.
    """
    query = GarmentItem.objects.filter(
        owner=owner, status__in=GarmentItem.WEARABLE_STATUSES
    )

    if not slot:
        # A photo of one garment, so the whole closet is fair game.
        pass
    elif slot in (Category.Slot.TOP, Category.Slot.BOTTOM):
        query = query.filter(category__slot__in=[slot, COVERS_BOTH])
    else:
        query = query.filter(category__slot=slot)

    return (
        query.with_last_occasion()
        .exclude(primary_color_hex="")
        .select_related("category", "storage_location", "storage_location__parent")
    )


def nearest(owner, slot: str, hex_value: str, limit: int = PER_REGION) -> list[Match]:
    """The closest things in the closet to one colour, best first."""
    scored = [
        Match(item, closeness(hex_value, item.primary_color_hex))
        for item in candidates(owner, slot)
    ]
    worth_it = [match for match in scored if match.score >= WORTH_SHOWING]
    worth_it.sort(key=lambda match: (-match.score, match.item.name))
    return worth_it[:limit]


def how_close(best_scores: list[int]) -> int:
    """
    One number for the whole look: the average of the best match for each part
    of it, with a part nothing matched counting as zero rather than being left
    out. Dropping it would let a closet with only shoes in it score full marks.
    """
    if not best_scores:
        return 0
    return round(sum(best_scores) / len(best_scores))
