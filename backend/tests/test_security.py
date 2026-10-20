import pytest
from django.core.cache import cache
from rest_framework.test import APIClient
from rest_framework.throttling import SimpleRateThrottle

from apps.wardrobe.models import GarmentItem

pytestmark = pytest.mark.django_db

PROTECTED = [
    "/api/auth/me/",
    "/api/auth/waiting/",
    "/api/wardrobe/items/",
    "/api/wardrobe/items/stats/",
    "/api/wardrobe/storage/",
    "/api/wardrobe/categories/",
    "/api/planner/outfits/",
    "/api/planner/today/",
    "/api/market/listings/",
    "/api/market/my-listings/",
    "/api/friends/",
    "/api/friends/my-code/",
    "/api/friends/loans/",
    "/api/friends/stats/",
]


@pytest.fixture(autouse=True)
def _empty_throttle_cache():
    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def two_people(signed_in):
    owner, owner_user = signed_in("owner@example.test")
    intruder, intruder_user = signed_in("intruder@example.test")
    return (owner, owner_user), (intruder, intruder_user)


@pytest.fixture
def owned_item(two_people, shirt_category):
    (owner, owner_user), _ = two_people
    response = owner.post(
        "/api/wardrobe/items/",
        {"name": "Blue Shirt", "category": shirt_category.id},
        format="json",
    )
    assert response.status_code == 201, response.data
    return response.data


@pytest.mark.parametrize("path", PROTECTED)
def test_every_endpoint_refuses_an_anonymous_caller(api, path):
    assert api.get(path).status_code == 401


@pytest.mark.parametrize(
    "token",
    [
        "",
        "not-a-token",
        "eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJ1c2VyX2lkIjoxfQ.",
        "a.b.c",
    ],
    ids=["empty", "garbage", "alg-none", "three-empty-parts"],
)
def test_a_forged_token_is_refused(api, token):
    api.credentials(HTTP_AUTHORIZATION="Bearer " + token)
    assert api.get("/api/auth/me/").status_code == 401


def test_a_tampered_signature_is_refused(api, make_user):
    make_user("tamper@example.test")
    issued = api.post(
        "/api/auth/login/",
        {"email": "tamper@example.test", "password": "Test-pass-9273"},
        format="json",
    ).data["access"]

    api.credentials(HTTP_AUTHORIZATION="Bearer " + issued)
    assert api.get("/api/auth/me/").status_code == 200

    api.credentials(HTTP_AUTHORIZATION="Bearer " + issued[:-6] + "AAAAAA")
    assert api.get("/api/auth/me/").status_code == 401


class TestOneAccountCannotReachAnother:
    def test_reading_is_refused(self, two_people, owned_item):
        _, (intruder, _) = two_people
        assert intruder.get(f"/api/wardrobe/items/{owned_item['id']}/").status_code == 404

    def test_changing_is_refused(self, two_people, owned_item):
        _, (intruder, _) = two_people
        response = intruder.patch(
            f"/api/wardrobe/items/{owned_item['id']}/", {"name": "Stolen"}, format="json"
        )
        assert response.status_code == 404

    def test_deleting_is_refused(self, two_people, owned_item):
        _, (intruder, _) = two_people
        assert intruder.delete(f"/api/wardrobe/items/{owned_item['id']}/").status_code == 404

    def test_and_the_item_survives_all_three(self, two_people, owned_item):
        (owner, _), (intruder, _) = two_people
        intruder.delete(f"/api/wardrobe/items/{owned_item['id']}/")
        response = owner.get(f"/api/wardrobe/items/{owned_item['id']}/")
        assert response.status_code == 200
        assert response.data["name"] == "Blue Shirt"

    @pytest.mark.parametrize("action", ["mark-worn", "toggle-laundry", "toggle-favorite"])
    def test_acting_on_it_through_its_own_endpoints_is_refused(
        self, two_people, owned_item, action
    ):
        _, (intruder, _) = two_people
        response = intruder.post(f"/api/wardrobe/items/{owned_item['id']}/{action}/", {}, format="json")
        assert response.status_code == 404

    def test_selling_somebody_elses_garment_is_refused(self, two_people, owned_item):
        _, (intruder, _) = two_people
        response = intruder.post(
            "/api/market/my-listings/",
            {"item": owned_item["id"], "asking_price": "100", "condition": "GOOD"},
            format="json",
        )
        assert response.status_code == 400

    def test_borrowing_somebody_elses_garment_is_refused(self, two_people, owned_item):
        _, (intruder, _) = two_people
        response = intruder.post(
            f"/api/friends/loans/ask/{owned_item['id']}/",
            {"borrow_from": "2030-01-01", "borrow_until": "2030-01-05"},
            format="json",
        )
        assert response.status_code == 400


def test_ownership_cannot_be_claimed_in_the_request_body(two_people, shirt_category):
    (owner, owner_user), (intruder, _) = two_people
    response = intruder.post(
        "/api/wardrobe/items/",
        {"name": "Forged", "category": shirt_category.id, "owner": owner_user.id},
        format="json",
    )
    assert response.status_code == 201
    assert GarmentItem.objects.get(pk=response.data["id"]).owner_id != owner_user.id


def test_planning_somebody_elses_garment_is_refused(two_people, owned_item):
    _, (intruder, _) = two_people
    response = intruder.post(
        "/api/planner/outfits/",
        {"planned_for": "2030-01-01", "items": [owned_item["id"]]},
        format="json",
    )
    assert response.status_code == 400


def test_nobody_can_promote_themselves(signed_in):
    client, user = signed_in("climber@example.test")
    response = client.patch(
        "/api/auth/me/",
        {"is_staff": True, "is_superuser": True},
        format="json",
    )
    assert response.status_code == 200
    user.refresh_from_db()
    assert not user.is_staff
    assert not user.is_superuser
    assert "is_staff" not in response.data


@pytest.mark.parametrize("secret", ["password", "pbkdf2", "argon2", "bcrypt"])
def test_a_registration_reply_carries_no_credential(api, secret):
    response = api.post(
        "/api/auth/register/",
        {
            "email": "fresh@example.test",
            "password": "Test-pass-9273",
            "password_confirm": "Test-pass-9273",
            "full_name": "Fresh Person",
        },
        format="json",
    )
    assert response.status_code == 201
    assert secret not in str(response.data).lower()


def test_a_profile_carries_no_password_field(signed_in):
    client, _ = signed_in("profile@example.test")
    assert "password" not in str(client.get("/api/auth/me/").data).lower()


class TestRefreshTokens:
    def _pair(self, api, make_user):
        make_user("rotate@example.test")
        response = api.post(
            "/api/auth/login/",
            {"email": "rotate@example.test", "password": "Test-pass-9273"},
            format="json",
        )
        assert response.status_code == 200
        return response.data

    def test_a_refresh_token_works_once(self, api, make_user):
        pair = self._pair(api, make_user)
        assert api.post("/api/auth/refresh/", {"refresh": pair["refresh"]}, format="json").status_code == 200

    def test_the_same_one_cannot_be_used_twice(self, api, make_user):
        pair = self._pair(api, make_user)
        api.post("/api/auth/refresh/", {"refresh": pair["refresh"]}, format="json")
        again = api.post("/api/auth/refresh/", {"refresh": pair["refresh"]}, format="json")
        assert again.status_code == 401

    def test_rotation_hands_back_a_different_token(self, api, make_user):
        pair = self._pair(api, make_user)
        rotated = api.post("/api/auth/refresh/", {"refresh": pair["refresh"]}, format="json")
        assert rotated.data["refresh"] != pair["refresh"]


def test_a_token_dies_with_the_account(signed_in, django_user_model):
    client, user = signed_in("ghost@example.test")
    assert client.get("/api/auth/me/").status_code == 200
    django_user_model.objects.filter(pk=user.pk).delete()
    assert client.get("/api/auth/me/").status_code == 401


@pytest.mark.parametrize(
    "payload",
    [
        "'; DROP TABLE garment_items; --",
        "1 OR 1=1",
        "../../etc/passwd",
        "<script>alert(1)</script>",
        "{{7*7}}",
    ],
)
def test_an_injection_attempt_is_treated_as_a_search_word(signed_in, owned_item, payload):
    client, _ = signed_in("searcher@example.test")
    response = client.get("/api/wardrobe/items/", {"search": payload})
    assert response.status_code == 200
    assert response.data["count"] == 0
    assert GarmentItem.objects.exists()


def test_markup_is_stored_and_returned_verbatim(signed_in, shirt_category):
    client, _ = signed_in("markup@example.test")
    created = client.post(
        "/api/wardrobe/items/",
        {"name": "<script>alert('x')</script>", "category": shirt_category.id},
        format="json",
    )
    read_back = client.get(f"/api/wardrobe/items/{created.data['id']}/")
    assert read_back.data["name"] == "<script>alert('x')</script>"


class TestAccountsCannotBeEnumerated:
    def test_a_wrong_password_and_an_unknown_email_answer_alike(self, api, make_user):
        make_user("known@example.test")
        unknown = api.post(
            "/api/auth/login/",
            {"email": "nobody@example.test", "password": "whatever"},
            format="json",
        )
        wrong = api.post(
            "/api/auth/login/",
            {"email": "known@example.test", "password": "whatever"},
            format="json",
        )
        assert unknown.status_code == wrong.status_code
        assert str(unknown.data) == str(wrong.data)

    def test_an_unknown_friend_code_never_confirms_a_code_exists(self, signed_in):
        client, _ = signed_in("guesser@example.test")
        response = client.post(
            "/api/friends/requests/by-code/", {"code": "ZZZZZZZZ"}, format="json"
        )
        assert response.status_code == 400
        assert "does not belong to anybody" in str(response.data)


def test_repeated_failed_logins_are_throttled(make_user, monkeypatch):
    monkeypatch.setattr(
        SimpleRateThrottle,
        "THROTTLE_RATES",
        {"anon": "1000/hour", "user": "1000/hour", "login": "3/min",
         "signup": "1000/hour", "friend-code": "1000/hour"},
    )
    make_user("bruteforce@example.test")
    client = APIClient()
    body = {"email": "bruteforce@example.test", "password": "wrong"}
    codes = [client.post("/api/auth/login/", body, format="json").status_code for _ in range(6)]
    assert 429 in codes, codes
    assert codes.index(429) <= 4, codes
