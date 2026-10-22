import io

import pytest
from PIL import Image
from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone

from apps.tryon import providers
from apps.tryon.models import TryOn
from apps.vision import storage
from apps.wardrobe.models import Category, GarmentItem

pytestmark = pytest.mark.django_db

ENDPOINTS = ["/api/try-on/", "/api/try-on/body-photo/", "/api/try-on/status/"]

def _png(width: int = 64, height: int = 96) -> bytes:
    """A real PNG, because ImageField verifies uploads through Pillow."""
    buffer = io.BytesIO()
    Image.new("RGB", (width, height), (90, 110, 160)).save(buffer, format="PNG")
    return buffer.getvalue()


TINY_PNG = _png()


class FakeUpload:
    def __init__(self, url, public_id):
        self.url = url
        self.public_id = public_id
        self.width = self.height = 512
        self.bytes = 1024
        self.format = "png"


@pytest.fixture
def no_cloudinary(monkeypatch):
    """Keeps every test off the real image host."""
    saved = []

    def fake_upload(file, folder, *, user_id=None, public_id=None, tags=None, overwrite=False):
        where = f"{folder}/u{user_id}/{public_id or 'generated'}"
        saved.append(where)
        return FakeUpload(f"https://images.test/{where}.png", where)

    deleted = []
    monkeypatch.setattr(storage, "is_configured", lambda: True)
    monkeypatch.setattr(storage, "upload_image", fake_upload)
    monkeypatch.setattr(storage, "delete_image", lambda public_id: deleted.append(public_id) or True)
    return {"saved": saved, "deleted": deleted}


@pytest.fixture
def category():
    found = Category.objects.filter(owner__isnull=True, slot=Category.Slot.TOP).first()
    return found or Category.objects.create(name="Shirt", slot=Category.Slot.TOP)


@pytest.fixture
def wearer(signed_in, category):
    client, user = signed_in("wearer@example.test")
    item = GarmentItem.objects.create(
        owner=user,
        name="Blue Shirt",
        category=category,
        clean_image_url="https://images.test/garments/blue.png",
    )
    return client, user, item


def give_body_photo(client, consent=True):
    return client.post(
        "/api/try-on/body-photo/",
        {"image": SimpleUploadedFile("me.png", TINY_PNG, content_type="image/png"),
         "consent": consent},
        format="multipart",
    )


@pytest.mark.parametrize("path", ENDPOINTS)
def test_every_endpoint_refuses_an_anonymous_caller(api, path):
    assert api.get(path).status_code == 401


class TestTheBodyPhoto:
    def test_none_is_saved_to_begin_with(self, wearer, no_cloudinary):
        client, _, _ = wearer
        assert client.get("/api/try-on/body-photo/").data["has_body_photo"] is False

    def test_it_cannot_be_saved_without_agreeing(self, wearer, no_cloudinary):
        client, user, _ = wearer
        response = give_body_photo(client, consent=False)
        assert response.status_code == 400
        user.refresh_from_db()
        assert user.body_photo_url == ""

    def test_agreeing_is_recorded_with_a_time(self, wearer, no_cloudinary):
        client, user, _ = wearer
        assert give_body_photo(client).status_code == 201
        user.refresh_from_db()
        assert user.body_photo_consent_at is not None
        assert user.body_photo_url.startswith("https://")

    def test_a_file_that_is_not_an_image_is_refused(self, wearer, no_cloudinary):
        client, _, _ = wearer
        response = client.post(
            "/api/try-on/body-photo/",
            {"image": SimpleUploadedFile("notes.txt", b"hello", content_type="text/plain"),
             "consent": True},
            format="multipart",
        )
        assert response.status_code == 400

    def test_uploading_again_replaces_rather_than_piles_up(self, wearer, no_cloudinary):
        client, _, _ = wearer
        give_body_photo(client)
        give_body_photo(client)
        # Both writes used the same fixed id, so there is one stored file.
        assert len(set(no_cloudinary["saved"])) == 1

    def test_deleting_it_removes_the_consent_too(self, wearer, no_cloudinary):
        client, user, _ = wearer
        give_body_photo(client)
        assert client.delete("/api/try-on/body-photo/").status_code == 204

        user.refresh_from_db()
        assert user.body_photo_url == ""
        assert user.body_photo_public_id == ""
        assert user.body_photo_consent_at is None

    def test_deleting_it_also_deletes_every_picture_made_from_it(
        self, wearer, no_cloudinary
    ):
        client, user, item = wearer
        give_body_photo(client)
        TryOn.objects.create(
            owner=user, item=item, garment_name=item.name,
            garment_image_url=item.clean_image_url, garment_slot="TOP",
            body_photo_url=user.body_photo_url,
            status=TryOn.Status.READY, result_public_id="tryon/results/u1/one",
        )
        assert TryOn.objects.filter(owner=user).count() == 1

        client.delete("/api/try-on/body-photo/")
        assert TryOn.objects.filter(owner=user).count() == 0
        assert "tryon/results/u1/one" in no_cloudinary["deleted"]

    def test_one_account_never_sees_another_body_photo(self, wearer, signed_in, no_cloudinary):
        client, _, _ = wearer
        give_body_photo(client)

        other, _ = signed_in("nosy@example.test")
        state = other.get("/api/try-on/body-photo/").data
        assert state["has_body_photo"] is False
        assert state["body_photo_url"] == ""


class TestAskingForAPicture:
    def test_it_needs_a_body_photo_first(self, wearer, no_cloudinary):
        client, _, item = wearer
        response = client.post("/api/try-on/", {"item": item.id}, format="json")
        assert response.status_code == 400
        assert "photo of yourself" in str(response.data)

    def test_somebody_elses_garment_is_refused(self, wearer, signed_in, category, no_cloudinary):
        client, _, _ = wearer
        give_body_photo(client)

        other, other_user = signed_in("other@example.test")
        theirs = GarmentItem.objects.create(
            owner=other_user, name="Their Coat", category=category,
            clean_image_url="https://images.test/theirs.png",
        )
        response = client.post("/api/try-on/", {"item": theirs.id}, format="json")
        assert response.status_code == 400
        assert TryOn.objects.filter(item=theirs).count() == 0

    @pytest.mark.parametrize("away", ["SOLD", "ARCHIVED", "LENT_OUT"])
    def test_a_garment_you_no_longer_have_is_refused(self, wearer, no_cloudinary, away):
        client, _, item = wearer
        give_body_photo(client)
        GarmentItem.objects.filter(pk=item.pk).update(status=away)

        response = client.post("/api/try-on/", {"item": item.id}, format="json")
        assert response.status_code == 400

    def test_a_garment_with_no_picture_is_refused(self, wearer, category, no_cloudinary):
        client, user, _ = wearer
        give_body_photo(client)
        bare = GarmentItem.objects.create(owner=user, name="No Photo", category=category)

        response = client.post("/api/try-on/", {"item": bare.id}, format="json")
        assert response.status_code == 400
        assert "no picture" in str(response.data)

    def test_the_daily_limit_is_enforced(self, wearer, no_cloudinary, settings):
        settings.TRYON_DAILY_LIMIT = 2
        client, user, item = wearer
        give_body_photo(client)
        for _ in range(2):
            TryOn.objects.create(
            owner=user, item=item, garment_name=item.name,
            garment_image_url=item.clean_image_url, garment_slot="TOP",
            body_photo_url=user.body_photo_url,
        )

        response = client.post("/api/try-on/", {"item": item.id}, format="json")
        assert response.status_code == 400
        assert "most anybody gets" in str(response.data)

    def test_yesterdays_pictures_do_not_count_against_today(
        self, wearer, no_cloudinary, settings
    ):
        settings.TRYON_DAILY_LIMIT = 1
        client, user, item = wearer
        give_body_photo(client)
        old = TryOn.objects.create(
            owner=user, item=item, garment_name=item.name,
            garment_image_url=item.clean_image_url, garment_slot="TOP",
            body_photo_url=user.body_photo_url,
        )
        TryOn.objects.filter(pk=old.pk).update(
            created_at=timezone.now() - timezone.timedelta(days=1)
        )
        assert TryOn.objects.made_today(user).count() == 0


class TestSubmitting:
    def test_a_queued_attempt_comes_back_straight_away_as_pending(
        self, wearer, no_cloudinary, monkeypatch
    ):
        client, user, item = wearer
        give_body_photo(client)
        monkeypatch.setattr(
            providers, "submit",
            lambda **kwargs: providers.Submitted(task_id="task-1", provider="test-model"),
        )

        response = client.post("/api/try-on/", {"item": item.id}, format="json")
        assert response.status_code == 201
        assert response.data["status"] == "PENDING"

        made = TryOn.objects.get(owner=user)
        assert made.provider_task_id == "task-1"
        assert made.is_waiting is True

    def test_the_garment_sent_off_is_the_background_free_cutout(
        self, wearer, no_cloudinary, monkeypatch
    ):
        client, _, item = wearer
        give_body_photo(client)
        seen = {}
        monkeypatch.setattr(
            providers, "submit",
            lambda **kwargs: seen.update(kwargs) or providers.Submitted("t", "m"),
        )

        client.post("/api/try-on/", {"item": item.id}, format="json")
        assert seen["garment_image_url"] == item.clean_image_url
        assert seen["slot"] == item.category.slot

    def test_a_refused_pairing_answers_400_and_is_not_left_pending(
        self, wearer, no_cloudinary, monkeypatch
    ):
        client, user, item = wearer
        give_body_photo(client)

        def refuse(**kwargs):
            raise providers.TryOnRefused("A clear, full-length photo works best.")

        monkeypatch.setattr(providers, "submit", refuse)
        response = client.post("/api/try-on/", {"item": item.id}, format="json")

        assert response.status_code == 400
        assert TryOn.objects.get(owner=user).status == TryOn.Status.FAILED

    def test_an_unreachable_supplier_answers_503(self, wearer, no_cloudinary, monkeypatch):
        client, user, item = wearer
        give_body_photo(client)

        def unavailable(**kwargs):
            raise providers.TryOnUnavailable("Could not reach the picture service.")

        monkeypatch.setattr(providers, "submit", unavailable)
        response = client.post("/api/try-on/", {"item": item.id}, format="json")

        assert response.status_code == 503
        assert TryOn.objects.get(owner=user).status == TryOn.Status.FAILED

    def test_an_unexpected_failure_is_not_leaked_to_the_caller(
        self, wearer, no_cloudinary, monkeypatch
    ):
        client, user, item = wearer
        give_body_photo(client)

        def explode(**kwargs):
            raise RuntimeError("secret internal detail")

        monkeypatch.setattr(providers, "submit", explode)
        response = client.post("/api/try-on/", {"item": item.id}, format="json")

        assert response.status_code == 503
        assert "secret internal detail" not in str(response.data)
        assert TryOn.objects.get(owner=user).status == TryOn.Status.FAILED

    def test_a_garment_the_supplier_cannot_wear_is_refused_before_anything_is_spent(
        self, wearer, no_cloudinary, monkeypatch
    ):
        client, user, _ = wearer
        give_body_photo(client)
        accessory = Category.objects.create(name="Watch", slot=Category.Slot.ACCESSORY)
        item = GarmentItem.objects.create(
            owner=user, name="Watch", category=accessory,
            clean_image_url="https://images.test/watch.png",
        )
        called = []
        monkeypatch.setattr(providers, "submit", lambda **k: called.append(k))

        response = client.post("/api/try-on/", {"item": item.id}, format="json")
        assert response.status_code == 400
        assert called == []


class TestWaitingForTheResult:
    @pytest.fixture
    def pending(self, wearer, no_cloudinary, monkeypatch):
        client, user, item = wearer
        give_body_photo(client)
        monkeypatch.setattr(
            providers, "submit",
            lambda **kwargs: providers.Submitted(task_id="task-1", provider="test-model"),
        )
        created = client.post("/api/try-on/", {"item": item.id}, format="json")
        return client, user, TryOn.objects.get(pk=created.data["id"])

    def test_a_finished_picture_is_copied_onto_this_projects_own_host(
        self, pending, monkeypatch
    ):
        client, _, attempt = pending
        monkeypatch.setattr(
            providers, "check",
            lambda task_id: providers.Progress(done=True, image_url="https://supplier.test/out.png"),
        )

        response = client.get(f"/api/try-on/{attempt.id}/")
        assert response.status_code == 200
        assert response.data["status"] == "READY"

        attempt.refresh_from_db()
        assert attempt.result_url.startswith("https://images.test/")
        assert "supplier.test" not in attempt.result_url

    def test_a_failure_at_the_supplier_is_recorded_in_plain_words(self, pending, monkeypatch):
        client, _, attempt = pending
        monkeypatch.setattr(
            providers, "check",
            lambda task_id: providers.Progress(done=True, error="That picture did not work."),
        )

        client.get(f"/api/try-on/{attempt.id}/")
        attempt.refresh_from_db()
        assert attempt.status == TryOn.Status.FAILED
        assert "Traceback" not in attempt.error

    def test_an_unfinished_one_stays_pending(self, pending, monkeypatch):
        client, _, attempt = pending
        monkeypatch.setattr(providers, "check", lambda task_id: providers.Progress(done=False))

        response = client.get(f"/api/try-on/{attempt.id}/")
        assert response.data["status"] == "PENDING"

    def test_a_briefly_unreachable_supplier_does_not_fail_the_picture(
        self, pending, monkeypatch
    ):
        client, _, attempt = pending

        def unreachable(task_id):
            raise providers.TryOnUnavailable("Could not reach the picture service.")

        monkeypatch.setattr(providers, "check", unreachable)
        response = client.get(f"/api/try-on/{attempt.id}/")

        assert response.data["status"] == "PENDING"
        attempt.refresh_from_db()
        assert attempt.status == TryOn.Status.PENDING

    def test_a_finished_picture_is_never_asked_about_twice(self, pending, monkeypatch):
        client, _, attempt = pending
        asked = []
        monkeypatch.setattr(
            providers, "check",
            lambda task_id: asked.append(task_id) or providers.Progress(
                done=True, image_url="https://supplier.test/out.png"
            ),
        )

        client.get(f"/api/try-on/{attempt.id}/")
        client.get(f"/api/try-on/{attempt.id}/")
        assert len(asked) == 1

    def test_the_list_moves_waiting_pictures_along_too(self, pending, monkeypatch):
        client, _, attempt = pending
        monkeypatch.setattr(
            providers, "check",
            lambda task_id: providers.Progress(done=True, image_url="https://supplier.test/out.png"),
        )

        rows = client.get("/api/try-on/").data["results"]
        assert rows[0]["status"] == "READY"


class TestPicturesStayPrivate:
    def test_another_account_cannot_list_them(self, wearer, signed_in, no_cloudinary):
        _, user, item = wearer
        TryOn.objects.create(
            owner=user, item=item, garment_name=item.name,
            garment_image_url=item.clean_image_url, garment_slot="TOP",
            body_photo_url="https://images.test/me.png",
        )

        other, _ = signed_in("snooper@example.test")
        assert other.get("/api/try-on/").data["count"] == 0

    def test_another_account_cannot_open_one(self, wearer, signed_in, no_cloudinary):
        _, user, item = wearer
        mine = TryOn.objects.create(
            owner=user, item=item, garment_name=item.name,
            garment_image_url=item.clean_image_url, garment_slot="TOP",
            body_photo_url="https://images.test/me.png",
        )
        other, _ = signed_in("snooper2@example.test")
        assert other.get(f"/api/try-on/{mine.id}/").status_code == 404

    def test_another_account_cannot_delete_one(self, wearer, signed_in, no_cloudinary):
        _, user, item = wearer
        mine = TryOn.objects.create(
            owner=user, item=item, garment_name=item.name,
            garment_image_url=item.clean_image_url, garment_slot="TOP",
            body_photo_url="https://images.test/me.png",
        )
        other, _ = signed_in("snooper3@example.test")
        assert other.delete(f"/api/try-on/{mine.id}/").status_code == 404
        assert TryOn.objects.filter(pk=mine.pk).exists()

    def test_the_owner_can_delete_their_own(self, wearer, no_cloudinary):
        client, user, item = wearer
        mine = TryOn.objects.create(
            owner=user, item=item, garment_name=item.name,
            garment_image_url=item.clean_image_url, garment_slot="TOP",
            body_photo_url="https://images.test/me.png",
            result_public_id="tryon/results/u1/x",
        )
        assert client.delete(f"/api/try-on/{mine.id}/").status_code == 204
        assert not TryOn.objects.filter(pk=mine.pk).exists()
        assert "tryon/results/u1/x" in no_cloudinary["deleted"]

    def test_the_body_photo_url_is_never_sent_back_in_a_picture_row(
        self, wearer, no_cloudinary
    ):
        client, user, item = wearer
        TryOn.objects.create(
            owner=user, item=item, garment_name=item.name,
            garment_image_url=item.clean_image_url, garment_slot="TOP",
            body_photo_url="https://images.test/private-body.png",
        )
        rows = client.get("/api/try-on/").data["results"]
        assert "private-body" not in str(rows)


class TestTheStatusEndpoint:
    def test_it_reports_whether_the_feature_is_switched_on(
        self, wearer, no_cloudinary, settings
    ):
        client, _, _ = wearer
        settings.TRYON_API_KEY = ""
        assert client.get("/api/try-on/status/").data["available"] is False
        settings.TRYON_API_KEY = "a-key"
        assert client.get("/api/try-on/status/").data["available"] is True

    def test_it_counts_what_is_left_today(self, wearer, no_cloudinary, settings):
        settings.TRYON_DAILY_LIMIT = 5
        client, user, item = wearer
        TryOn.objects.create(
            owner=user, item=item, garment_name=item.name,
            garment_image_url=item.clean_image_url, garment_slot="TOP",
            body_photo_url="https://images.test/me.png",
        )

        state = client.get("/api/try-on/status/").data
        assert state["daily_limit"] == 5
        assert state["used_today"] == 1
        assert state["left_today"] == 4

    def test_it_never_reports_a_negative_number_left(self, wearer, no_cloudinary, settings):
        settings.TRYON_DAILY_LIMIT = 1
        client, user, item = wearer
        for _ in range(3):
            TryOn.objects.create(
            owner=user, item=item, garment_name=item.name,
            garment_image_url=item.clean_image_url, garment_slot="TOP",
            body_photo_url="https://images.test/me.png",
        )
        assert client.get("/api/try-on/status/").data["left_today"] == 0

    def test_one_account_count_does_not_include_another(
        self, wearer, signed_in, no_cloudinary
    ):
        _, user, item = wearer
        TryOn.objects.create(
            owner=user, item=item, garment_name=item.name,
            garment_image_url=item.clean_image_url, garment_slot="TOP",
            body_photo_url="https://images.test/me.png",
        )

        other, _ = signed_in("separate@example.test")
        assert other.get("/api/try-on/status/").data["used_today"] == 0


def test_the_supplier_module_refuses_cleanly_when_no_key_is_set(settings):
    settings.TRYON_API_KEY = ""
    assert providers.is_configured() is False
    with pytest.raises(providers.TryOnUnavailable):
        providers.submit(
            body_photo_url="https://images.test/me.png",
            garment_image_url="https://images.test/shirt.png",
            slot="TOP",
        )
    with pytest.raises(providers.TryOnUnavailable):
        providers.check("task-1")


@pytest.mark.parametrize(
    "slot,expected",
    [("TOP", True), ("BOTTOM", True), ("OUTERWEAR", True), ("FULL_BODY", True),
     ("FOOTWEAR", False), ("ACCESSORY", False), ("HEADWEAR", False)],
)
def test_only_garments_the_supplier_can_draw_are_offered(slot, expected):
    assert providers.supports(slot) is expected


class TestTryingOnAPhotoThatIsNotInTheCloset:
    @pytest.fixture
    def ready(self, wearer, no_cloudinary, monkeypatch):
        client, user, _ = wearer
        give_body_photo(client)
        monkeypatch.setattr(
            providers, "submit",
            lambda **kwargs: providers.Submitted(task_id="task-1", provider="test-model"),
        )
        return client, user

    def upload(self, client, slot="TOP", save_as=None):
        body = {
            "image": SimpleUploadedFile("kurta.png", TINY_PNG, content_type="image/png"),
            "garment_slot": slot,
        }
        if save_as is not None:
            body["save_as"] = save_as
        return client.post("/api/try-on/", body, format="multipart")

    def test_a_photo_can_be_tried_on_without_keeping_it(self, ready):
        client, user = ready
        response = self.upload(client)

        assert response.status_code == 201, response.data
        made = TryOn.objects.get(owner=user)
        assert made.item is None
        assert made.garment_slot == "TOP"
        assert made.garment_image_url.startswith("https://images.test/")
        assert GarmentItem.objects.filter(owner=user).count() == 1  # only the fixture's

    def test_the_part_of_the_body_must_be_stated(self, ready):
        client, _ = ready
        response = client.post(
            "/api/try-on/",
            {"image": SimpleUploadedFile("x.png", TINY_PNG, content_type="image/png")},
            format="multipart",
        )
        assert response.status_code == 400
        assert "garment_slot" in str(response.data)

    @pytest.mark.parametrize("slot", ["TOP", "BOTTOM", "FULL_BODY"])
    def test_each_offered_part_of_the_body_is_accepted(self, ready, slot):
        client, _ = ready
        assert self.upload(client, slot=slot).status_code == 201

    def test_a_part_of_the_body_the_supplier_cannot_draw_is_refused(self, ready):
        client, _ = ready
        assert self.upload(client, slot="FOOTWEAR").status_code == 400

    def test_the_chosen_part_is_what_gets_sent(self, ready, monkeypatch):
        client, _ = ready
        seen = {}
        monkeypatch.setattr(
            providers, "submit",
            lambda **kwargs: seen.update(kwargs) or providers.Submitted("t", "m"),
        )
        self.upload(client, slot="BOTTOM")
        assert seen["slot"] == "BOTTOM"

    def test_a_name_keeps_it_in_the_closet(self, ready):
        client, user = ready
        response = self.upload(client, save_as="Blue Kurta")

        assert response.status_code == 201
        kept = GarmentItem.objects.get(owner=user, name="Blue Kurta")
        assert kept.original_image_url.startswith("https://images.test/")
        assert TryOn.objects.get(owner=user).item_id == kept.id

    def test_a_kept_garment_is_filed_under_the_right_kind(self, ready):
        client, user = ready
        self.upload(client, slot="BOTTOM", save_as="Black Trousers")
        kept = GarmentItem.objects.get(owner=user, name="Black Trousers")
        assert kept.category.slot == "BOTTOM"

    def test_a_blank_name_keeps_nothing(self, ready):
        client, user = ready
        self.upload(client, save_as="   ")
        assert TryOn.objects.get(owner=user).item is None

    def test_a_file_that_is_not_an_image_is_refused(self, ready):
        client, _ = ready
        response = client.post(
            "/api/try-on/",
            {"image": SimpleUploadedFile("notes.txt", b"hello", content_type="text/plain"),
             "garment_slot": "TOP"},
            format="multipart",
        )
        assert response.status_code == 400

    def test_deleting_the_picture_removes_an_upload_nothing_else_points_at(
        self, ready, no_cloudinary
    ):
        client, user = ready
        self.upload(client)
        made = TryOn.objects.get(owner=user)
        orphan = made.garment_public_id
        assert orphan

        client.delete(f"/api/try-on/{made.id}/")
        assert orphan in no_cloudinary["deleted"]

    def test_deleting_the_picture_leaves_a_kept_garment_alone(self, ready, no_cloudinary):
        client, user = ready
        self.upload(client, save_as="Blue Kurta")
        made = TryOn.objects.get(owner=user)
        assert made.garment_public_id == ""

        client.delete(f"/api/try-on/{made.id}/")
        assert GarmentItem.objects.filter(owner=user, name="Blue Kurta").exists()


def test_a_picture_outlives_the_garment_it_was_made_from(signed_in, shirt_category):
    client, user = signed_in("outlives@example.test")
    item = GarmentItem.objects.create(
        owner=user, name="Blue Shirt", category=shirt_category,
        clean_image_url="https://images.test/blue.png",
    )
    made = TryOn.objects.create(
        owner=user, item=item, garment_name=item.name,
        garment_image_url=item.clean_image_url, garment_slot="TOP",
        body_photo_url="https://images.test/me.png",
        status=TryOn.Status.READY, result_url="https://images.test/out.png",
    )

    item.delete()
    made.refresh_from_db()
    assert made.item is None
    assert made.garment_name == "Blue Shirt"
    assert made.result_url == "https://images.test/out.png"
