"""
What a sale means for one particular closet.

A list of discounts is a shopping page and every shop already has one. The
only thing this app can say that a shop cannot is what the person already
owns, so two claims are made and both are checked against real rows:

  "You have nothing to wear here"  - that slot is genuinely empty.
  "You already own one of these"   - same slot, near enough the same colour.

Neither is a guess. Anything that could not be proved is simply not said.
"""

from __future__ import annotations

from dataclasses import dataclass

from apps.intelligence.colors import NAMED_COLORS, closeness
from apps.wardrobe.models import Category, GarmentItem

Slot = Category.Slot

# A kurta or a shalwar kameez stands in for a top and for a bottom, so it
# counts as already owning either.
COVERS_BOTH = Slot.FULL_BODY

# Above this the two colours read as the same thing to a shopper. It is the
# same figure the closet matching calls "very close".
SAME_COLOUR = 70

# Slots worth telling somebody they have nothing in. An empty accessory drawer
# is not a gap in a wardrobe, it is a preference.
WORTH_FILLING = [Slot.TOP, Slot.BOTTOM, Slot.FOOTWEAR, Slot.OUTERWEAR, Slot.FULL_BODY]


@dataclass(frozen=True)
class Owned:
    """One thing in the closet, reduced to what a comparison needs."""

    id: int
    name: str
    slot: str
    hex: str


@dataclass(frozen=True)
class Closet:
    """A snapshot of one person's wearable clothes, read once per page."""

    items: list[Owned]

    @property
    def filled_slots(self) -> set[str]:
        filled = {item.slot for item in self.items}

        # Owning a shalwar kameez means the top half and the bottom half are
        # both covered, so neither counts as empty.
        if COVERS_BOTH in filled:
            filled |= {Slot.TOP, Slot.BOTTOM}

        # And it holds the other way round. Somebody with shirts and trousers
        # is not missing something to wear, so telling them they have nothing
        # for every dress and every suit in the shops would be false alarm on
        # a third of the page.
        if {Slot.TOP, Slot.BOTTOM} <= filled:
            filled.add(COVERS_BOTH)

        return filled

    def is_empty_at(self, slot: str) -> bool:
        return slot in WORTH_FILLING and slot not in self.filled_slots

    def nearest_owned(self, slot: str, hex_value: str) -> tuple[Owned | None, int]:
        """
        The closest thing already owned that would be worn in the same place.

        Returns nothing at all when the colour is unknown: saying "you own one
        of these" on the strength of a guess would be worse than staying quiet.
        """
        if not hex_value or not slot or slot == Slot.OTHER:
            return None, 0

        if slot in (Slot.TOP, Slot.BOTTOM):
            wanted = {slot, COVERS_BOTH}
        elif slot == COVERS_BOTH:
            wanted = {COVERS_BOTH}
        else:
            wanted = {slot}

        best, best_score = None, 0
        for item in self.items:
            if item.slot not in wanted or not item.hex:
                continue
            score = closeness(hex_value, item.hex)
            if score > best_score:
                best, best_score = item, score

        return (best, best_score) if best_score >= SAME_COLOUR else (None, 0)

    def count_like(self, slot: str, hex_value: str) -> int:
        if not hex_value:
            return 0
        if slot in (Slot.TOP, Slot.BOTTOM):
            wanted = {slot, COVERS_BOTH}
        else:
            wanted = {slot}
        return sum(
            1
            for item in self.items
            if item.slot in wanted and item.hex and closeness(hex_value, item.hex) >= SAME_COLOUR
        )


# Still theirs even when they cannot put it on today. Something in the wash or
# lent to a friend is still owned, and telling somebody to buy another one
# because today's is dirty would be daft.
GONE = [GarmentItem.Status.SOLD, GarmentItem.Status.ARCHIVED]


def closet_for(owner) -> Closet:
    """Everything they still own, in one query."""
    rows = (
        GarmentItem.objects.filter(owner=owner)
        .exclude(status__in=GONE)
        .values_list("id", "name", "category__slot", "primary_color_hex")
    )
    return Closet([
        Owned(id=row[0], name=row[1], slot=row[2] or Slot.OTHER, hex=row[3] or "")
        for row in rows
    ])


def empty_slots(closet: Closet) -> list[str]:
    """Places on the body this person owns nothing for."""
    return [slot for slot in WORTH_FILLING if closet.is_empty_at(slot)]


def owned_color_names(closet: Closet) -> dict[str, set[str]]:
    """
    Which of our colour names this person already has, slot by slot.

    Worked out once so that "hide what I already own" can be a real database
    filter rather than something applied after a page has been counted, which
    would leave the page numbers wrong.
    """
    owned: dict[str, set[str]] = {}
    for slot in [Slot.TOP, Slot.BOTTOM, Slot.FULL_BODY, Slot.FOOTWEAR,
                 Slot.OUTERWEAR, Slot.HEADWEAR, Slot.ACCESSORY]:
        names = {
            name
            for name, hex_value in NAMED_COLORS
            if closet.nearest_owned(slot, hex_value)[0] is not None
        }
        if names:
            owned[slot] = names
    return owned


def verdict_for(deal, closet: Closet) -> dict:
    """The two claims, for one product, as plain sentences a screen can print."""
    if closet.is_empty_at(deal.slot):
        return {
            "fills_gap": True,
            "already_owned": False,
            "owned_count": 0,
            "owned_item_id": None,
            "note": "You have nothing in your closet for this.",
        }

    nearest, _ = closet.nearest_owned(deal.slot, deal.color_hex)
    if nearest is not None:
        count = closet.count_like(deal.slot, deal.color_hex)
        if count > 1:
            note = f"You already own {count} in this colour, including {nearest.name}."
        else:
            note = f"You already own {nearest.name}, which is close to this."
        return {
            "fills_gap": False,
            "already_owned": True,
            "owned_count": count,
            "owned_item_id": nearest.id,
            "note": note,
        }

    return {
        "fills_gap": False,
        "already_owned": False,
        "owned_count": 0,
        "owned_item_id": None,
        "note": "",
    }
