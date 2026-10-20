import pytest

from apps.wardrobe.models import Category, GarmentItem, StorageLocation

pytestmark = pytest.mark.django_db


@pytest.fixture
def closet(signed_in):
    client, user = signed_in("closet@example.test")
    room = StorageLocation.objects.create(owner=user, name="Room", kind="ROOM")
    drawer = StorageLocation.objects.create(owner=user, name="Drawer", kind="DRAWER", parent=room)
    shirt = Category.objects.filter(owner__isnull=True, slot=Category.Slot.TOP).first()
    jeans = Category.objects.filter(owner__isnull=True, slot=Category.Slot.BOTTOM).first()
    if shirt is None:
        shirt = Category.objects.create(name="Shirt", slot=Category.Slot.TOP)
    if jeans is None:
        jeans = Category.objects.create(name="Jeans", slot=Category.Slot.BOTTOM)
    return client, user, drawer, shirt, jeans


def add(client, name, category, **extra):
    body = {"name": name, "category": category.id, **extra}
    response = client.post("/api/wardrobe/items/", body, format="json")
    assert response.status_code == 201, response.data
    return response.data


def stats(client):
    return client.get("/api/wardrobe/items/stats/").data


def set_status(client, item_id, value):
    return client.patch(f"/api/wardrobe/items/{item_id}/", {"status": value}, format="json")


class TestCountsLeaveOutWhatYouNoLongerHave:
    @pytest.fixture
    def three_things(self, closet):
        client, user, drawer, shirt, jeans = closet
        kept = add(client, "Blue Shirt", shirt, storage_location=drawer.id,
                   purchase_price="1000.00", is_favorite=True)
        spare = add(client, "White Shirt", shirt, storage_location=drawer.id, purchase_price="2000.00")
        loose = add(client, "Old Jeans", jeans, purchase_price="3000.00")
        return client, user, drawer, shirt, jeans, kept, spare, loose

    def test_everything_counts_to_begin_with(self, three_things):
        client = three_things[0]
        counted = stats(client)
        assert counted["total"] == 3
        assert counted["gone"] == 0
        assert counted["favorites"] == 1
        assert counted["unplaced"] == 1
        assert counted["total_spent"] == 6000.0

    @pytest.mark.parametrize("gone_status", ["ARCHIVED", "SOLD"])
    def test_a_thing_that_has_left_stops_counting_as_owned(self, three_things, gone_status):
        client, _, _, _, _, kept, _, _ = three_things
        set_status(client, kept["id"], gone_status)
        counted = stats(client)
        assert counted["total"] == 2
        assert counted["gone"] == 1
        assert counted["favorites"] == 0
        assert counted["total_spent"] == 5000.0

    def test_the_breakdown_always_adds_up_to_the_total(self, three_things):
        client, _, _, _, _, kept, _, _ = three_things
        set_status(client, kept["id"], "SOLD")
        counted = stats(client)
        assert sum(row["count"] for row in counted["by_slot"]) == counted["total"]

    def test_a_drawer_stops_counting_what_left_it(self, three_things):
        client, _, drawer, _, _, kept, _, _ = three_things
        before = client.get("/api/wardrobe/storage/").data["results"]
        assert next(r for r in before if r["id"] == drawer.id)["item_count"] == 2

        set_status(client, kept["id"], "ARCHIVED")
        after = client.get("/api/wardrobe/storage/").data["results"]
        assert next(r for r in after if r["id"] == drawer.id)["item_count"] == 1

    def test_the_storage_tree_agrees_with_the_list(self, three_things):
        client, _, drawer, _, _, kept, _, _ = three_things
        set_status(client, kept["id"], "ARCHIVED")

        found = []

        def walk(nodes):
            for node in nodes:
                if node["id"] == drawer.id:
                    found.append(node["item_count"])
                walk(node.get("children") or [])

        walk(client.get("/api/wardrobe/storage/tree/").data)
        assert found == [1]

    def test_a_category_stops_counting_what_left(self, three_things):
        client, _, _, shirt, _, kept, _, _ = three_things
        set_status(client, kept["id"], "SOLD")
        rows = client.get("/api/wardrobe/categories/", {"page_size": 100}).data["results"]
        assert next(r for r in rows if r["id"] == shirt.id)["item_count"] == 1

    def test_what_is_in_this_drawer_leaves_out_what_was_sold(self, three_things):
        client, _, drawer, _, _, kept, spare, _ = three_things
        set_status(client, kept["id"], "SOLD")
        inside = client.get(f"/api/wardrobe/storage/{drawer.id}/items/").data
        assert [row["id"] for row in inside] == [spare["id"]]

    def test_nothing_gone_counts_as_forgotten(self, three_things):
        client, _, _, _, _, kept, _, _ = three_things
        assert stats(client)["not_worn_in_90_days"] == 3
        set_status(client, kept["id"], "ARCHIVED")
        assert stats(client)["not_worn_in_90_days"] == 2


class TestWhereThingsAppear:
    def test_the_closet_list_leaves_out_what_has_gone(self, closet):
        client, _, _, shirt, _ = closet
        item = add(client, "Blue Shirt", shirt)
        set_status(client, item["id"], "ARCHIVED")
        assert client.get("/api/wardrobe/items/").data["count"] == 0

    def test_asking_for_gone_things_finds_them(self, closet):
        client, _, _, shirt, _ = closet
        item = add(client, "Blue Shirt", shirt)
        set_status(client, item["id"], "ARCHIVED")
        page = client.get("/api/wardrobe/items/", {"gone": "true"}).data
        assert [row["id"] for row in page["results"]] == [item["id"]]

    def test_sold_and_put_away_share_one_list(self, closet):
        client, _, _, shirt, jeans = closet
        first = add(client, "Blue Shirt", shirt)
        second = add(client, "Old Jeans", jeans)
        set_status(client, first["id"], "SOLD")
        set_status(client, second["id"], "ARCHIVED")
        assert client.get("/api/wardrobe/items/", {"gone": "true"}).data["count"] == 2

    def test_the_search_box_works_inside_that_list(self, closet):
        client, _, _, shirt, jeans = closet
        first = add(client, "Blue Shirt", shirt)
        second = add(client, "Old Jeans", jeans)
        set_status(client, first["id"], "ARCHIVED")
        set_status(client, second["id"], "ARCHIVED")
        page = client.get("/api/wardrobe/items/", {"gone": "true", "search": "Jeans"}).data
        assert page["count"] == 1

    def test_opening_a_gone_thing_directly_still_works(self, closet):
        client, _, _, shirt, _ = closet
        item = add(client, "Blue Shirt", shirt)
        set_status(client, item["id"], "ARCHIVED")
        assert client.get(f"/api/wardrobe/items/{item['id']}/").status_code == 200


class TestSomethingYouDoNotHaveCannotBeUsed:
    @pytest.mark.parametrize("gone_status", ["ARCHIVED", "SOLD", "LENT_OUT"])
    def test_it_cannot_be_recorded_as_worn(self, closet, gone_status):
        client, _, _, shirt, _ = closet
        item = add(client, "Blue Shirt", shirt)
        GarmentItem.objects.filter(pk=item["id"]).update(status=gone_status)
        response = client.post(f"/api/wardrobe/items/{item['id']}/mark-worn/", {}, format="json")
        assert response.status_code == 400

    @pytest.mark.parametrize("gone_status", ["ARCHIVED", "SOLD", "LENT_OUT"])
    def test_it_cannot_go_to_the_wash(self, closet, gone_status):
        client, _, _, shirt, _ = closet
        item = add(client, "Blue Shirt", shirt)
        GarmentItem.objects.filter(pk=item["id"]).update(status=gone_status)
        response = client.post(f"/api/wardrobe/items/{item['id']}/toggle-laundry/", {}, format="json")
        assert response.status_code == 400

    @pytest.mark.parametrize("gone_status", ["ARCHIVED", "SOLD", "LENT_OUT"])
    def test_it_cannot_be_put_up_for_sale(self, closet, gone_status):
        client, _, _, shirt, _ = closet
        item = add(client, "Blue Shirt", shirt)
        GarmentItem.objects.filter(pk=item["id"]).update(status=gone_status)
        response = client.post(
            "/api/market/my-listings/",
            {"item": item["id"], "asking_price": "500", "condition": "GOOD"},
            format="json",
        )
        assert response.status_code == 400

    def test_the_refusal_names_the_reason_in_plain_words(self, closet):
        client, _, _, shirt, _ = closet
        item = add(client, "Blue Shirt", shirt)
        set_status(client, item["id"], "ARCHIVED")
        response = client.post(f"/api/wardrobe/items/{item['id']}/mark-worn/", {}, format="json")
        assert "put away" in str(response.data).lower()


class TestBringingSomethingBack:
    def test_it_keeps_its_history(self, closet):
        client, _, drawer, shirt, _ = closet
        item = add(client, "Red Kurta", shirt, storage_location=drawer.id, is_favorite=True)
        client.post(f"/api/wardrobe/items/{item['id']}/mark-worn/", {"date": "2026-09-10"}, format="json")
        client.post(f"/api/wardrobe/items/{item['id']}/mark-worn/", {"date": "2026-09-12"}, format="json")

        set_status(client, item["id"], "ARCHIVED")
        set_status(client, item["id"], "IN_WARDROBE")

        back = client.get(f"/api/wardrobe/items/{item['id']}/").data
        assert back["status"] == "IN_WARDROBE"
        assert back["is_favorite"] is True
        assert back["wear_count"] == 2
        assert back["storage_location"] == drawer.id

    def test_and_can_be_worn_again(self, closet):
        client, _, _, shirt, _ = closet
        item = add(client, "Red Kurta", shirt)
        set_status(client, item["id"], "ARCHIVED")
        set_status(client, item["id"], "IN_WARDROBE")
        response = client.post(f"/api/wardrobe/items/{item['id']}/mark-worn/", {}, format="json")
        assert response.status_code == 200


def test_an_empty_closet_with_a_past_is_not_a_new_closet(closet):
    client, _, _, shirt, jeans = closet
    for name, category in [("Blue Shirt", shirt), ("Old Jeans", jeans)]:
        item = add(client, name, category)
        set_status(client, item["id"], "ARCHIVED")

    counted = stats(client)
    assert counted["total"] == 0
    assert counted["gone"] == 2
    assert counted["by_slot"] == []
    assert counted["total_spent"] == 0
