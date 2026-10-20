import datetime as dt

import pytest

from apps.circle.models import Friend, Loan
from apps.wardrobe.models import Category, GarmentItem

pytestmark = pytest.mark.django_db

SOON = str(dt.date.today() + dt.timedelta(days=1))
LATER = str(dt.date.today() + dt.timedelta(days=5))


@pytest.fixture
def category():
    found = Category.objects.filter(owner__isnull=True, slot=Category.Slot.TOP).first()
    return found or Category.objects.create(name="Shirt", slot=Category.Slot.TOP)


def code_of(client):
    return client.get("/api/friends/my-code/").data["code"]


def add_friend(me, them, nickname=""):
    """
    `them` sends the code request and `me` accepts, so the label belongs to the
    accepting side. Returns my row for them, which is the one with the id my
    own requests use.
    """
    sent = them.post("/api/friends/requests/by-code/", {"code": code_of(me)}, format="json")
    assert sent.status_code == 201, sent.data
    accepted = me.post(
        f"/api/friends/requests/{sent.data['id']}/accept/", {"nickname": nickname}, format="json"
    )
    assert accepted.status_code == 201, accepted.data
    return accepted.data


class TestFriendCodes:
    def test_a_code_is_eight_characters(self, signed_in):
        client, _ = signed_in("coded@example.test")
        assert len(code_of(client)) == 8

    def test_it_does_not_change_between_visits(self, signed_in):
        client, _ = signed_in("steady@example.test")
        assert code_of(client) == code_of(client)

    def test_it_avoids_letters_people_misread(self, signed_in):
        client, _ = signed_in("legible@example.test")
        assert not set(code_of(client)) & set("OIL01")

    def test_two_accounts_never_share_one(self, signed_in):
        first, _ = signed_in("one@example.test")
        second, _ = signed_in("two@example.test")
        assert code_of(first) != code_of(second)

    def test_a_new_code_retires_the_old_one(self, signed_in):
        owner, _ = signed_in("rotating@example.test")
        stranger, _ = signed_in("stranger@example.test")
        old = code_of(owner)

        fresh = owner.post("/api/friends/my-code/", {}, format="json").data["code"]
        assert fresh != old

        assert stranger.post(
            "/api/friends/requests/by-code/", {"code": old}, format="json"
        ).status_code == 400
        assert stranger.post(
            "/api/friends/requests/by-code/", {"code": fresh}, format="json"
        ).status_code == 201

    @pytest.mark.parametrize("guess", ["Ali Khan", "someone@example.test", "ali"])
    def test_nobody_can_be_found_by_name_or_email(self, signed_in, guess):
        client, _ = signed_in("searcher@example.test")
        response = client.post("/api/friends/requests/by-code/", {"code": guess}, format="json")
        assert response.status_code == 400

    def test_capitals_and_dashes_are_forgiven(self, signed_in):
        owner, _ = signed_in("loose@example.test")
        asker, _ = signed_in("asker@example.test")
        typed = code_of(owner).lower()
        assert asker.post(
            "/api/friends/requests/by-code/", {"code": typed}, format="json"
        ).status_code == 201

    def test_your_own_code_is_refused(self, signed_in):
        client, _ = signed_in("selfish@example.test")
        response = client.post(
            "/api/friends/requests/by-code/", {"code": code_of(client)}, format="json"
        )
        assert response.status_code == 400


class TestTwoFriendsWithTheSameName:
    @pytest.fixture
    def three_accounts(self, signed_in):
        me, _ = signed_in("me@example.test", full_name="Zohaib Sadiq", city="Lahore")
        first, _ = signed_in("ali-one@example.test", full_name="Ali Khan", city="Lahore")
        second, _ = signed_in("ali-two@example.test", full_name="Ali Khan", city="Karachi")
        return me, first, second

    def test_they_never_appear_under_the_same_label(self, three_accounts):
        me, first, second = three_accounts
        add_friend(me, first)
        add_friend(me, second)

        labels = [row["nickname"] for row in me.get("/api/friends/").data["results"]]
        assert len(labels) == 2
        assert len(set(labels)) == 2

    def test_the_second_one_carries_a_city_to_tell_them_apart(self, three_accounts):
        me, first, second = three_accounts
        add_friend(me, first)
        add_friend(me, second)

        labels = [row["nickname"] for row in me.get("/api/friends/").data["results"]]
        assert any("Karachi" in label for label in labels)

    def test_a_label_already_in_use_is_refused(self, three_accounts):
        me, first, second = three_accounts
        add_friend(me, first, nickname="Ali Khan")

        sent = second.post("/api/friends/requests/by-code/", {"code": code_of(me)}, format="json")
        response = me.post(
            f"/api/friends/requests/{sent.data['id']}/accept/",
            {"nickname": "Ali Khan"},
            format="json",
        )
        assert response.status_code == 400

    def test_renaming_onto_a_taken_label_is_refused(self, three_accounts):
        me, first, second = three_accounts
        add_friend(me, first, nickname="Ali Khan")
        mine = add_friend(me, second, nickname="Ali from work")

        response = me.patch(f"/api/friends/{mine['id']}/", {"nickname": "Ali Khan"}, format="json")
        assert response.status_code == 400
        assert "already have a friend called" in str(response.data)

    def test_capitals_do_not_sneak_a_duplicate_past_it(self, three_accounts):
        me, first, second = three_accounts
        add_friend(me, first, nickname="Ali Khan")
        mine = add_friend(me, second, nickname="Ali from work")

        response = me.patch(f"/api/friends/{mine['id']}/", {"nickname": "ali khan"}, format="json")
        assert response.status_code == 400

    def test_a_private_label_is_never_shown_to_the_person_it_names(self, three_accounts):
        me, first, _ = three_accounts
        add_friend(me, first, nickname="Ali from college")
        theirs = [row["nickname"] for row in first.get("/api/friends/").data["results"]]
        assert "Ali from college" not in theirs


class TestAClosetStaysShutUntilItIsOpened:
    @pytest.fixture
    def pair(self, signed_in, category):
        lender, lender_user = signed_in("lender@example.test", full_name="Lender")
        borrower, _ = signed_in("borrower@example.test", full_name="Borrower")
        mine = add_friend(borrower, lender)
        shared = GarmentItem.objects.create(owner=lender_user, name="Blue Blazer", category=category)
        private = GarmentItem.objects.create(
            owner=lender_user, name="Old Vest", category=category, is_lendable=False
        )
        return lender, lender_user, borrower, mine, shared, private

    def test_sharing_starts_switched_off(self, pair):
        _, lender_user, _, _, _, _ = pair
        assert lender_user.shares_closet is False

    def test_nothing_is_visible_before_it_is_switched_on(self, pair):
        _, _, borrower, mine, _, _ = pair
        response = borrower.get(f"/api/friends/{mine['id']}/closet/")
        assert response.status_code == 400
        assert "not opened their closet" in str(response.data)

    def test_once_open_the_shareable_things_appear(self, pair):
        lender, _, borrower, mine, shared, _ = pair
        lender.patch("/api/auth/me/", {"shares_closet": True}, format="json")
        names = [row["name"] for row in borrower.get(f"/api/friends/{mine['id']}/closet/").data]
        assert names == ["Blue Blazer"]

    def test_anything_marked_private_stays_hidden(self, pair):
        lender, _, borrower, mine, _, private = pair
        lender.patch("/api/auth/me/", {"shares_closet": True}, format="json")
        names = [row["name"] for row in borrower.get(f"/api/friends/{mine['id']}/closet/").data]
        assert private.name not in names

    @pytest.mark.parametrize(
        "secret",
        ["purchase_price", "cost_per_wear", "wear_count", "location_path",
         "storage_location", "last_worn_date"],
    )
    def test_a_friend_never_sees_what_a_thing_cost_or_where_it_lives(self, pair, secret):
        lender, _, borrower, mine, _, _ = pair
        lender.patch("/api/auth/me/", {"shares_closet": True}, format="json")
        row = borrower.get(f"/api/friends/{mine['id']}/closet/").data[0]
        assert secret not in row

    def test_blocking_hides_everything_without_saying_so(self, pair):
        lender, lender_user, borrower, mine, _, _ = pair
        lender.patch("/api/auth/me/", {"shares_closet": True}, format="json")
        Friend.objects.filter(owner=lender_user).update(blocked=True)

        response = borrower.get(f"/api/friends/{mine['id']}/closet/")
        assert response.status_code == 400
        assert "blocked" not in str(response.data).lower()


class TestLending:
    @pytest.fixture
    def ready(self, signed_in, category):
        lender, lender_user = signed_in("owner2@example.test", full_name="Owner")
        borrower, _ = signed_in("asker2@example.test", full_name="Asker")
        mine = add_friend(borrower, lender)
        lender.patch("/api/auth/me/", {"shares_closet": True}, format="json")
        item = GarmentItem.objects.create(owner=lender_user, name="Blue Blazer", category=category)
        return lender, lender_user, borrower, mine, item

    def ask(self, borrower, item, **overrides):
        body = {"borrow_from": SOON, "borrow_until": LATER, **overrides}
        return borrower.post(f"/api/friends/loans/ask/{item.id}/", body, format="json")

    def test_a_request_can_be_sent(self, ready):
        _, _, borrower, _, item = ready
        response = self.ask(borrower, item)
        assert response.status_code == 201
        assert response.data["status"] == "ASKED"

    def test_the_same_thing_cannot_be_asked_for_twice(self, ready):
        _, _, borrower, _, item = ready
        self.ask(borrower, item)
        assert self.ask(borrower, item).status_code == 400

    @pytest.mark.parametrize(
        "overrides",
        [
            {"borrow_from": LATER, "borrow_until": SOON},
            {"borrow_from": str(dt.date.today() - dt.timedelta(days=3))},
            {"borrow_until": str(dt.date.today() + dt.timedelta(days=200))},
            {"message": "call me on 0300 1234567"},
        ],
        ids=["backwards", "in-the-past", "too-long", "carries-a-phone-number"],
    )
    def test_a_bad_request_is_refused(self, ready, overrides):
        _, _, borrower, _, item = ready
        assert self.ask(borrower, item, **overrides).status_code == 400

    def test_only_the_lender_can_agree(self, ready):
        _, _, borrower, _, item = ready
        loan = self.ask(borrower, item).data
        assert borrower.post(f"/api/friends/loans/{loan['id']}/agree/").status_code == 404

    def test_agreeing_marks_the_garment_lent_without_giving_it_away(self, ready):
        lender, lender_user, borrower, _, item = ready
        loan = self.ask(borrower, item).data
        assert lender.post(f"/api/friends/loans/{loan['id']}/agree/").status_code == 200

        item.refresh_from_db()
        assert item.status == GarmentItem.Status.LENT_OUT
        assert item.owner_id == lender_user.id
        assert lender.get("/api/wardrobe/items/stats/").data["gone"] == 0

    def test_a_lent_thing_stops_being_offered_to_other_friends(self, ready):
        lender, _, borrower, mine, item = ready
        loan = self.ask(borrower, item).data
        lender.post(f"/api/friends/loans/{loan['id']}/agree/")
        names = [row["name"] for row in borrower.get(f"/api/friends/{mine['id']}/closet/").data]
        assert item.name not in names

    def test_getting_it_back_puts_it_in_the_wardrobe(self, ready):
        lender, _, borrower, _, item = ready
        loan = self.ask(borrower, item).data
        lender.post(f"/api/friends/loans/{loan['id']}/agree/")
        assert lender.post(f"/api/friends/loans/{loan['id']}/returned/").status_code == 200

        item.refresh_from_db()
        assert item.status == GarmentItem.Status.IN_WARDROBE

    def test_a_cancelled_request_frees_the_thing_to_be_asked_for_again(self, ready):
        _, _, borrower, _, item = ready
        loan = self.ask(borrower, item).data
        assert borrower.post(f"/api/friends/loans/{loan['id']}/cancel/").status_code == 204
        assert self.ask(borrower, item).status_code == 201

    def test_being_told_no_is_final(self, ready):
        lender, _, borrower, _, item = ready
        loan = self.ask(borrower, item).data
        assert lender.post(f"/api/friends/loans/{loan['id']}/decline/").status_code == 200
        assert lender.post(f"/api/friends/loans/{loan['id']}/decline/").status_code == 400

    def test_a_loan_names_the_other_side_by_your_own_label(self, ready):
        lender, _, borrower, _, item = ready
        self.ask(borrower, item)
        row = lender.get("/api/friends/loans/").data["results"][0]
        assert row["their_name"] == "Asker"


class TestTheWaitingBadge:
    def test_it_starts_at_zero(self, signed_in):
        client, _ = signed_in("quiet@example.test")
        assert client.get("/api/auth/waiting/").data["total"] == 0

    def test_a_friend_request_shows_up_and_clears_when_answered(self, signed_in):
        asker, _ = signed_in("badge-asker@example.test")
        receiver, _ = signed_in("badge-receiver@example.test")

        sent = asker.post(
            "/api/friends/requests/by-code/", {"code": code_of(receiver)}, format="json"
        )
        assert receiver.get("/api/auth/waiting/").data["friend_requests"] == 1

        receiver.post(f"/api/friends/requests/{sent.data['id']}/decline/")
        assert receiver.get("/api/auth/waiting/").data["friend_requests"] == 0

    def test_a_borrow_request_counts_for_the_lender_only(self, signed_in, category):
        lender, lender_user = signed_in("badge-lender@example.test")
        borrower, _ = signed_in("badge-borrower@example.test")
        add_friend(borrower, lender)
        lender.patch("/api/auth/me/", {"shares_closet": True}, format="json")
        item = GarmentItem.objects.create(owner=lender_user, name="Coat", category=category)

        borrower.post(
            f"/api/friends/loans/ask/{item.id}/",
            {"borrow_from": SOON, "borrow_until": LATER},
            format="json",
        )
        assert lender.get("/api/auth/waiting/").data["borrow_asks"] == 1
        assert borrower.get("/api/auth/waiting/").data["borrow_asks"] == 0

    def test_being_late_is_reported_but_is_not_somebody_waiting_on_you(
        self, signed_in, category
    ):
        lender, lender_user = signed_in("late-lender@example.test")
        borrower, borrower_user = signed_in("late-borrower@example.test")
        item = GarmentItem.objects.create(
            owner=lender_user, name="Coat", category=category, status=GarmentItem.Status.LENT_OUT
        )
        Loan.objects.create(
            item=item,
            lender=lender_user,
            borrower=borrower_user,
            status=Loan.Status.AGREED,
            borrow_from=dt.date.today() - dt.timedelta(days=10),
            borrow_until=dt.date.today() - dt.timedelta(days=3),
        )
        waiting = borrower.get("/api/auth/waiting/").data
        assert waiting["overdue"] == 1
        assert waiting["total"] == 0


def test_removing_a_friend_removes_them_on_both_sides(signed_in):
    me, _ = signed_in("remover@example.test")
    them, _ = signed_in("removed@example.test")
    mine = add_friend(me, them)

    assert me.delete(f"/api/friends/{mine['id']}/").status_code == 204
    assert me.get("/api/friends/").data["results"] == []
    assert them.get("/api/friends/").data["results"] == []
