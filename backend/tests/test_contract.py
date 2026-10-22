"""
Compares the TypeScript the browser trusts against the schema the API
publishes. A field the frontend declares but the API never sends compiles
cleanly and is undefined at runtime, which is how a card reading a nested
object that had become a plain id reached a browser.
"""

import pathlib
import re

import pytest
from drf_spectacular.generators import SchemaGenerator

FRONTEND = pathlib.Path(__file__).resolve().parents[2] / "frontend" / "src" / "types"

TYPE_FILES = ["wardrobe.ts", "planner.ts", "shopping.ts", "market.ts", "friends.ts",
              "tryon.ts", "index.ts"]

# TypeScript interface -> schema component. Anything listed here is checked in
# both directions: nothing declared that is not sent, nothing sent that is not
# declared.
PAIRS = [
    ("StorageLocation", "StorageLocation"),
    ("Category", "Category"),
    ("GarmentListItem", "GarmentItemList"),
    ("WearEvent", "WearEvent"),
    ("Weather", "Weather"),
    ("PlannedOutfit", "PlannedOutfit"),
    ("Deal", "Deal"),
    ("Freshness", "Freshness"),
    ("PriceChange", "PriceChange"),
    ("User", "User"),
    ("Listing", "Listing"),
    ("Enquiry", "Enquiry"),
    ("Block", "Block"),
    ("MarketplaceStats", "MarketplaceStats"),
    ("Friend", "Friend"),
    ("FriendRequest", "FriendRequest"),
    ("GarmentToBorrow", "GarmentToBorrow"),
    ("Loan", "Loan"),
    ("CircleStats", "CircleStats"),
    ("Waiting", "Waiting"),
    ("TryOn", "TryOn"),
    ("BodyPhotoState", "BodyPhotoState"),
    ("TryOnAvailability", "TryOnStatus"),
]

# TypeScript union type -> schema enum.
UNIONS = [
    ("ItemStatus", "GarmentStatusEnum"),
    ("Condition", "ConditionEnum"),
    ("ListingStatus", "ListingStatusEnum"),
    ("EnquiryStatus", "EnquiryStatusEnum"),
    ("Audience", "AudienceEnum"),
    ("FriendRequestStatus", "FriendStatusEnum"),
    ("LoanStatus", "LoanStatusEnum"),
    ("TryOnStatus", "TryOnStatusEnum"),
]


def _typescript() -> str:
    found = []
    for name in TYPE_FILES:
        path = FRONTEND / name
        if path.exists():
            found.append(path.read_text(encoding="utf-8"))
    assert found, f"No TypeScript types found under {FRONTEND}"
    return "\n\n".join(found)


@pytest.fixture(scope="module")
def source() -> str:
    return _typescript()


@pytest.fixture(scope="module")
def components() -> dict:
    schema = SchemaGenerator().get_schema(request=None, public=True)
    return schema["components"]["schemas"]


def declared_fields(source: str, interface: str) -> set[str] | None:
    """
    Field names on one interface. `extends` is not followed: an interface built
    on another is checked through the one it extends.
    """
    match = re.search(r"export interface " + interface + r"\b[^{]*\{(.*?)\n\}", source, re.S)
    if not match:
        return None
    return {m.group(1) for m in re.finditer(r"^\s{2}(\w+)\??:", match.group(1), re.M)}


def union_values(source: str, name: str) -> set[str]:
    match = re.search(r"export type " + name + r"\s*=\s*([^;]+);", source)
    return set(re.findall(r'"([A-Z_]+)"', match.group(1))) if match else set()


@pytest.mark.parametrize("interface,component", PAIRS, ids=[p[0] for p in PAIRS])
def test_the_frontend_declares_only_fields_the_api_sends(source, components, interface, component):
    declared = declared_fields(source, interface)
    assert declared is not None, f"interface {interface} is gone from the TypeScript"
    assert component in components, f"the API no longer publishes {component}"

    if interface == "Garment":
        declared |= declared_fields(source, "GarmentListItem") or set()

    sent = set(components[component].get("properties", {}))
    missing = declared - sent
    assert not missing, (
        f"{interface} declares {sorted(missing)}, which {component} does not send. "
        "Reading one of those gives undefined at runtime."
    )


@pytest.mark.parametrize("interface,component", PAIRS, ids=[p[0] for p in PAIRS])
def test_the_frontend_knows_about_every_field_the_api_sends(source, components, interface, component):
    declared = declared_fields(source, interface)
    assert declared is not None
    if interface == "Garment":
        declared |= declared_fields(source, "GarmentListItem") or set()

    unknown = set(components[component].get("properties", {})) - declared
    assert not unknown, f"{component} sends {sorted(unknown)}, which {interface} does not declare."


@pytest.mark.parametrize("union,enum", UNIONS, ids=[u[0] for u in UNIONS])
def test_hardcoded_values_match_the_api(source, components, union, enum):
    assert enum in components, f"the API no longer publishes {enum}"
    declared = union_values(source, union)
    assert declared, f"union {union} is gone from the TypeScript"
    assert declared == set(components[enum]["enum"]), {
        "only in the app": sorted(declared - set(components[enum]["enum"])),
        "only on the server": sorted(set(components[enum]["enum"]) - declared),
    }
