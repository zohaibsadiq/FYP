"""
GarmentToBorrowSerializer lists its fields by hand instead of reusing the
closet serializer. Reusing it would hand a friend the price paid, the cost per
wear, the wear count and where the garment is kept, plus whatever gets added to
it next.
"""

from __future__ import annotations

from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework import serializers

from apps.community.models import refuse_contact_details
from apps.wardrobe.models import GarmentItem

from .models import Friend, FriendRequest, Loan

User = get_user_model()


class FriendPersonSerializer(serializers.ModelSerializer):
    """The subset of an account that a friend is allowed to read."""

    # Spelled out because display_name is worked out in code, not stored in a
    # column, so the API docs generator cannot work out its type by itself.
    display_name = serializers.CharField(read_only=True)

    class Meta:
        model = User
        fields = ["id", "display_name", "city"]
        read_only_fields = fields


class GarmentToBorrowSerializer(serializers.ModelSerializer):
    """Enough to recognise a thing and ask for it. Nothing about its owner's money."""

    category_name = serializers.CharField(source="category.name", read_only=True)
    category_slot = serializers.CharField(source="category.slot", read_only=True)
    display_image_url = serializers.CharField(read_only=True)
    availability = serializers.SerializerMethodField()

    class Meta:
        model = GarmentItem
        fields = [
            "id", "name", "brand", "size", "material",
            "category_name", "category_slot",
            "primary_color_hex", "primary_color_name",
            "display_image_url", "availability",
        ]
        read_only_fields = fields

    def get_availability(self, item: GarmentItem) -> str:
        if item.status == GarmentItem.Status.LENT_OUT:
            return "Lent out just now"
        if item.status == GarmentItem.Status.IN_LAUNDRY:
            return "In the wash"
        return "Free"


class FriendSerializer(serializers.ModelSerializer):
    person = FriendPersonSerializer(read_only=True)
    shares_closet = serializers.SerializerMethodField()
    items_to_borrow = serializers.SerializerMethodField()

    class Meta:
        model = Friend
        fields = ["id", "nickname", "blocked", "person", "shares_closet", "items_to_borrow", "created_at"]
        read_only_fields = ["id", "person", "shares_closet", "items_to_borrow", "created_at"]

    def get_shares_closet(self, friend: Friend) -> bool:
        """Whether the friend has opened their closet, not whether the viewer has."""
        return bool(friend.person.shares_closet) and not friend.blocked

    def get_items_to_borrow(self, friend: Friend) -> int:
        if not self.get_shares_closet(friend):
            return 0
        return lendable_items(friend.person).count()

    def validate_nickname(self, value: str) -> str:
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Give them a name you will recognise.")
        return value

    def validate(self, attrs):
        """
        The database refuses duplicate nicknames too, but its error reads as a
        crash. Somebody with two friends called Ali Khan deserves to be told the
        name is taken and asked for another, such as "Ali Khan (uni)".
        """
        nickname = attrs.get("nickname")
        if nickname is None:
            return attrs

        owner = self.instance.owner if self.instance else self.context["request"].user
        clash = Friend.objects.filter(owner=owner, nickname__iexact=nickname)
        if self.instance:
            clash = clash.exclude(pk=self.instance.pk)
        if clash.exists():
            raise serializers.ValidationError(
                {"nickname": f"You already have a friend called {nickname}. "
                             "Add something to tell them apart, like where you know them from."}
            )
        return attrs


def lendable_items(owner):
    """
    What a friend of `owner` is allowed to see: things still in the wardrobe or
    in the wash, left switched on for lending. Sold, put away and already-lent
    things are not offered, and neither is anything marked private.
    """
    return (
        GarmentItem.objects.filter(
            owner=owner,
            is_lendable=True,
            status__in=[GarmentItem.Status.IN_WARDROBE, GarmentItem.Status.IN_LAUNDRY],
        )
        .select_related("category")
        .order_by("name")
    )


class FriendRequestSerializer(serializers.ModelSerializer):
    from_person = FriendPersonSerializer(source="from_user", read_only=True)
    to_person = FriendPersonSerializer(source="to_user", read_only=True)
    status_label = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = FriendRequest
        fields = ["id", "from_person", "to_person", "status", "status_label", "created_at"]
        read_only_fields = fields


class SendRequestSerializer(serializers.Serializer):
    """Asking by code, which is the only way in."""

    code = serializers.CharField(max_length=16)

    def validate_code(self, value: str) -> str:
        me = self.context["request"].user
        tidy = value.strip().upper().replace(" ", "").replace("-", "")
        if not tidy:
            raise serializers.ValidationError("Type the code your friend gave you.")

        try:
            them = User.objects.get(friend_code=tidy)
        except User.DoesNotExist:
            # The same words whatever went wrong, on purpose. A different message
            # for "no such code" would turn this box into a way of trying codes
            # until one lands.
            raise serializers.ValidationError("That code does not belong to anybody. Check it and try again.")

        if them.pk == me.pk:
            raise serializers.ValidationError("That is your own code.")
        if Friend.objects.filter(owner=me, person=them).exists():
            raise serializers.ValidationError(f"{them.display_name} is already your friend.")
        if FriendRequest.objects.filter(
            from_user=me, to_user=them, status=FriendRequest.Status.SENT
        ).exists():
            raise serializers.ValidationError("You have already asked. Wait for an answer.")

        self.context["them"] = them
        return tidy

    def create(self, validated_data):
        me = self.context["request"].user
        them = self.context["them"]

        # If Ali asks Sara and Sara then types Ali's code, there is already a
        # request waiting from Ali. That one is used instead of opening a
        # second request going the other way.
        theirs = FriendRequest.objects.filter(
            from_user=them, to_user=me, status=FriendRequest.Status.SENT
        ).first()
        if theirs:
            return theirs

        return FriendRequest.objects.create(from_user=me, to_user=them)


class AcceptRequestSerializer(serializers.Serializer):
    """Accepting is where the name gets settled, before anything is shared."""

    nickname = serializers.CharField(max_length=60, required=False, allow_blank=True)

    def validate_nickname(self, value: str) -> str:
        me = self.context["request"].user
        value = (value or "").strip()
        if value and Friend.objects.filter(owner=me, nickname__iexact=value).exists():
            raise serializers.ValidationError(
                f"You already have a friend called {value}. Pick something else, "
                "like where you know them from."
            )
        return value


class MyCodeSerializer(serializers.Serializer):
    """The owner's friend code, and whether their closet is shared at all."""

    code = serializers.CharField()
    shares_closet = serializers.BooleanField(required=False)


class CircleStatsSerializer(serializers.Serializer):
    """The handful of numbers the friends page opens with."""

    friends = serializers.IntegerField()
    requests_waiting = serializers.IntegerField()
    asks_waiting_on_me = serializers.IntegerField()
    lent_out = serializers.IntegerField()
    borrowed = serializers.IntegerField()
    overdue = serializers.IntegerField()


class LoanItemSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source="category.name", read_only=True)

    class Meta:
        model = GarmentItem
        fields = [
            "id", "name", "brand", "size", "category_name",
            "display_image_url", "primary_color_hex", "primary_color_name",
        ]
        read_only_fields = fields


class LoanSerializer(serializers.ModelSerializer):
    item = LoanItemSerializer(read_only=True)
    lender = FriendPersonSerializer(read_only=True)
    borrower = FriendPersonSerializer(read_only=True)
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    is_overdue = serializers.BooleanField(read_only=True)
    days_late = serializers.IntegerField(read_only=True)
    their_name = serializers.SerializerMethodField()

    class Meta:
        model = Loan
        fields = [
            "id", "item", "lender", "borrower", "their_name",
            "status", "status_label", "borrow_from", "borrow_until",
            "message", "is_overdue", "days_late",
            "created_at", "answered_at", "returned_at",
        ]
        read_only_fields = fields

    def get_their_name(self, loan: Loan) -> str:
        """
        The viewer's own nickname for the other person, so a loan reads the
        same way as the friend list. Two friends who are both "Ali Khan" stay
        apart here as well.
        """
        me = self.context["request"].user
        other_id = loan.borrower_id if loan.lender_id == me.pk else loan.lender_id
        friend = Friend.objects.filter(owner=me, person_id=other_id).first()
        if friend:
            return friend.nickname
        other = loan.borrower if loan.lender_id == me.pk else loan.lender
        return other.display_name


class AskToBorrowSerializer(serializers.ModelSerializer):
    class Meta:
        model = Loan
        fields = ["borrow_from", "borrow_until", "message"]

    def validate_message(self, value: str) -> str:
        refuse_contact_details(value)
        return value

    def validate(self, attrs):
        start, end = attrs["borrow_from"], attrs["borrow_until"]
        today = timezone.localdate()
        if start < today:
            raise serializers.ValidationError({"borrow_from": "Pick today or a day after it."})
        if end < start:
            raise serializers.ValidationError(
                {"borrow_until": "The day you give it back cannot be before the day you get it."}
            )
        if (end - start).days > 90:
            raise serializers.ValidationError(
                {"borrow_until": "Three months is the longest a thing can be borrowed for."}
            )
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        try:
            return Loan.objects.create(**validated_data)
        except IntegrityError:
            # Two people tapping at the same moment. The database rule decides
            # who won, and the other is told plainly instead of seeing a crash.
            raise serializers.ValidationError(
                {"item": "Somebody asked for this one a moment before you did."}
            )
