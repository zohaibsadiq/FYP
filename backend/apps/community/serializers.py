"""
Shapes for the marketplace.

The important one here is GarmentForSaleSerializer. The closet already has a
serializer for a garment, but it carries where the thing is kept in somebody's
house, what they paid for it, how many times they have worn it and what for.
None of that belongs in front of a stranger, so this file describes the
garment again, from scratch, with only what a buyer needs.
"""

from __future__ import annotations

from decimal import Decimal

from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from apps.wardrobe.models import GarmentItem

from .models import Block, Enquiry, Listing, Report, refuse_contact_details


class GarmentForSaleSerializer(serializers.ModelSerializer):
    """
    A garment as a buyer sees it.

    Deliberately written out rather than reused. Every field here was chosen;
    nothing arrives because it happened to be on the model.
    """

    category_name = serializers.CharField(source="category.name", read_only=True)
    category_slot = serializers.CharField(source="category.slot", read_only=True)
    display_image_url = serializers.CharField(read_only=True)
    pattern_label = serializers.CharField(source="get_pattern_display", read_only=True)

    class Meta:
        model = GarmentItem
        fields = [
            "name", "brand", "size", "material", "pattern", "pattern_label",
            "category_name", "category_slot",
            "display_image_url", "primary_color_hex", "primary_color_name",
        ]
        read_only_fields = fields


class SellerSerializer(serializers.Serializer):
    """Who is selling, as far as anybody browsing is concerned."""

    id = serializers.IntegerField(read_only=True)
    display_name = serializers.CharField(read_only=True)
    city = serializers.CharField(read_only=True)


class ListingSerializer(serializers.ModelSerializer):
    """One listing on the browse page."""

    item = GarmentForSaleSerializer(read_only=True)
    seller = SellerSerializer(read_only=True)
    condition_label = serializers.CharField(source="get_condition_display", read_only=True)
    audience_label = serializers.CharField(source="get_audience_display", read_only=True)
    status_label = serializers.CharField(source="get_status_display", read_only=True)

    # Where the person looking at it stands with this listing, so the screen
    # can show "Asked" instead of offering the button again.
    my_enquiry_status = serializers.SerializerMethodField()

    class Meta:
        model = Listing
        fields = [
            "id", "item", "seller",
            "asking_price", "currency",
            "condition", "condition_label",
            "audience", "audience_label",
            "note", "city",
            "status", "status_label",
            "created_at",
            "my_enquiry_status",
        ]
        read_only_fields = fields

    @extend_schema_field(serializers.CharField)
    def get_my_enquiry_status(self, obj) -> str:
        """Empty when this person has not asked. Annotated by the view."""
        return getattr(obj, "my_enquiry_status", "") or ""


class MyListingSerializer(ListingSerializer):
    """A seller's own listing, which may carry things a buyer must not see."""

    enquiry_count = serializers.SerializerMethodField()
    waiting_count = serializers.SerializerMethodField()

    class Meta(ListingSerializer.Meta):
        fields = ListingSerializer.Meta.fields + ["enquiry_count", "waiting_count", "closed_at"]
        read_only_fields = fields

    @extend_schema_field(serializers.IntegerField)
    def get_enquiry_count(self, obj) -> int:
        return getattr(obj, "enquiries_total", 0)

    @extend_schema_field(serializers.IntegerField)
    def get_waiting_count(self, obj) -> int:
        return getattr(obj, "enquiries_waiting", 0)


class ListingWriteSerializer(serializers.ModelSerializer):
    """Putting something up for sale, or changing what is already up."""

    class Meta:
        model = Listing
        fields = [
            "id", "item", "asking_price", "currency",
            "condition", "audience", "note", "city",
        ]

    def validate_item(self, item):
        owner = self.context["request"].user
        if item.owner_id != owner.id:
            # The same answer a missing row would give, so this cannot be used
            # to find out whether an id belongs to somebody.
            raise serializers.ValidationError("No such item in your closet.")
        if item.status == GarmentItem.Status.SOLD:
            raise serializers.ValidationError("That one is already sold.")

        already = Listing.objects.filter(item=item, status__in=Listing.OPEN_STATUSES)
        if self.instance:
            already = already.exclude(pk=self.instance.pk)
        if already.exists():
            raise serializers.ValidationError("That one is already up for sale.")
        return item

    def validate_note(self, note):
        try:
            refuse_contact_details(note)
        except Exception as exc:
            raise serializers.ValidationError(str(exc.messages[0] if hasattr(exc, "messages") else exc))
        return note

    def validate_asking_price(self, price):
        if price < 0:
            raise serializers.ValidationError("A price cannot be below zero.")
        return price


class PriceSuggestionSerializer(serializers.Serializer):
    """What a garment might fetch now, offered as a starting point only."""

    suggested_price = serializers.DecimalField(
        max_digits=10, decimal_places=2, allow_null=True,
        help_text="Null when nobody recorded what the garment cost.",
    )
    currency = serializers.CharField()
    paid = serializers.DecimalField(max_digits=10, decimal_places=2, allow_null=True)
    condition = serializers.CharField()
    explanation = serializers.CharField(help_text="Ready to show, and honest about being a guess.")


class EnquirySerializer(serializers.ModelSerializer):
    """
    One request to buy.

    The contact block is filled in only on an accepted request, and only for
    the two people involved. Everybody else sees it empty.
    """

    status_label = serializers.CharField(source="get_status_display", read_only=True)
    listing = ListingSerializer(read_only=True)
    buyer = SellerSerializer(read_only=True)
    contact = serializers.SerializerMethodField()

    class Meta:
        model = Enquiry
        fields = [
            "id", "listing", "buyer", "message",
            "status", "status_label",
            "created_at", "answered_at", "contact",
        ]
        read_only_fields = fields

    @extend_schema_field(serializers.DictField)
    def get_contact(self, obj) -> dict | None:
        """
        How to reach the other side, or nothing at all.

        Three things have to be true: the request was accepted, and the person
        asking is one of the two involved. Anything else gets nothing, not an
        empty-looking shape that hints there is something behind it.
        """
        request = self.context.get("request")
        if request is None or not obj.contact_is_shared:
            return None

        me = request.user
        if me.id == obj.buyer_id:
            other = obj.listing.seller
        elif me.id == obj.listing.seller_id:
            other = obj.buyer
        else:
            return None

        return {
            "name": other.display_name,
            "city": other.city,
            "email": other.email,
            "phone": other.phone,
        }


class EnquiryWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Enquiry
        fields = ["id", "message"]

    def validate_message(self, message):
        try:
            refuse_contact_details(message)
        except Exception as exc:
            raise serializers.ValidationError(str(exc.messages[0] if hasattr(exc, "messages") else exc))
        return message


class BlockSerializer(serializers.ModelSerializer):
    blocked_name = serializers.CharField(source="blocked.display_name", read_only=True)

    class Meta:
        model = Block
        fields = ["id", "blocked", "blocked_name", "created_at"]
        read_only_fields = ["id", "blocked_name", "created_at"]

    def validate_blocked(self, person):
        if person.id == self.context["request"].user.id:
            raise serializers.ValidationError("You cannot block yourself.")
        return person


class ReportSerializer(serializers.ModelSerializer):
    reason_label = serializers.CharField(source="get_reason_display", read_only=True)

    class Meta:
        model = Report
        fields = ["id", "listing", "reason", "reason_label", "note", "created_at"]
        read_only_fields = ["id", "reason_label", "created_at"]


class MarketplaceStatsSerializer(serializers.Serializer):
    """What the marketplace holds, for the page heading."""

    listings_open = serializers.IntegerField()
    cities = serializers.IntegerField()
    my_listings = serializers.IntegerField()
    enquiries_waiting_on_me = serializers.IntegerField(
        help_text="Requests on my listings that I have not answered."
    )
    my_enquiries_answered = serializers.IntegerField(
        help_text="Requests I sent that have since been accepted."
    )


RESALE_NOTE = (
    "A starting point from what you paid and how worn it is. "
    "Change it to whatever you think is fair."
)


def suggestion_for(item: GarmentItem, condition: str) -> dict:
    """The body of the price-suggestion endpoint, kept beside the serializer it fills."""
    suggested = Listing.suggest_price(item, condition)
    if suggested is None:
        explanation = (
            "There is no purchase price saved for this one, so there is nothing "
            "to work from. Put in whatever you think is fair."
        )
    else:
        explanation = RESALE_NOTE
    return {
        "suggested_price": suggested,
        "currency": item.currency or "PKR",
        "paid": Decimal(item.purchase_price) if item.purchase_price is not None else None,
        "condition": condition,
        "explanation": explanation,
    }
