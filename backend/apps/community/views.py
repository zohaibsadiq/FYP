from __future__ import annotations

from django.db import IntegrityError, transaction
from django.db.models import Count, OuterRef, Q, Subquery
from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_view
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.wardrobe.models import GarmentItem

from .filters import ListingFilter
from .models import Block, Enquiry, Listing, Report
from .serializers import (
    BlockSerializer,
    EnquirySerializer,
    EnquiryWriteSerializer,
    ListingSerializer,
    ListingWriteSerializer,
    MarketplaceStatsSerializer,
    MyListingSerializer,
    PriceSuggestionSerializer,
    ReportSerializer,
    suggestion_for,
)

ITEM_JOINS = ["item", "item__category", "seller"]


def _with_my_enquiry(queryset, user):
    """
    Adds whether this person has already asked about each listing, so the page
    can show "Asked" instead of offering the button again.

    Done inside the main query rather than one query per listing. The browse
    page shows 24 listings at a time and each one needs the same answer.
    """
    mine = Enquiry.objects.filter(listing_id=OuterRef("pk"), buyer=user).order_by("-created_at")
    return queryset.annotate(my_enquiry_status=Subquery(mine.values("status")[:1]))


@extend_schema_view(
    list=extend_schema(
        tags=["Marketplace"],
        summary="Things other people are selling",
        description=(
            "Everything currently for sale, except your own listings and "
            "anyone either of you has blocked.\n\n"
            "A listing carries the garment as a buyer should see it: its "
            "picture, name, brand, size, colour and kind. It never carries "
            "where the seller keeps it, what they paid, or how often they "
            "wore it."
        ),
    ),
    retrieve=extend_schema(tags=["Marketplace"], summary="One listing"),
)
class ListingViewSet(viewsets.ReadOnlyModelViewSet):
    """Read-only browse. MyListingViewSet handles the selling side."""

    queryset = Listing.objects.none()
    serializer_class = ListingSerializer
    filterset_class = ListingFilter
    search_fields = ["item__name", "item__brand", "note"]
    ordering_fields = ["created_at", "asking_price"]
    ordering = ["-created_at"]

    def get_queryset(self):
        return _with_my_enquiry(
            Listing.objects.visible_to(self.request.user).select_related(*ITEM_JOINS),
            self.request.user,
        )

    @extend_schema(
        tags=["Marketplace"],
        summary="Ask to buy this",
        request=EnquiryWriteSerializer,
        responses={201: EnquirySerializer},
    )
    @action(detail=True, methods=["post"])
    def enquire(self, request, pk=None):
        listing = self.get_object()
        if listing.seller_id == request.user.id:
            raise ValidationError({"listing": "You cannot ask to buy your own listing."})
        if not listing.is_open:
            raise ValidationError({"listing": "That one is no longer for sale."})

        form = EnquiryWriteSerializer(data=request.data)
        form.is_valid(raise_exception=True)

        try:
            with transaction.atomic():
                enquiry = Enquiry.objects.create(
                    listing=listing, buyer=request.user, **form.validated_data
                )
        except IntegrityError as exc:
            # Two taps arriving at the same moment both pass the check above,
            # and the second one hits the database rule. It gets the same
            # readable answer instead of a crash.
            raise ValidationError(
                {"listing": "You have already asked about this one."}
            ) from exc

        return Response(
            EnquirySerializer(enquiry, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )

    @extend_schema(
        tags=["Marketplace"],
        summary="Report this listing for somebody to look at",
        request=ReportSerializer,
        responses={201: ReportSerializer},
    )
    @action(detail=True, methods=["post"])
    def report(self, request, pk=None):
        listing = self.get_object()
        form = ReportSerializer(data={**request.data, "listing": listing.pk})
        form.is_valid(raise_exception=True)
        try:
            form.save(reporter=request.user)
        except IntegrityError as exc:
            raise ValidationError({"listing": "You have already reported this one."}) from exc
        return Response(form.data, status=status.HTTP_201_CREATED)


@extend_schema_view(
    list=extend_schema(tags=["Marketplace"], summary="Things I am selling"),
    create=extend_schema(tags=["Marketplace"], summary="Put one of my clothes up for sale"),
    partial_update=extend_schema(tags=["Marketplace"], summary="Change my price or wording"),
    destroy=extend_schema(tags=["Marketplace"], summary="Delete a listing outright"),
)
class MyListingViewSet(viewsets.ModelViewSet):
    """A seller's own listings. Never shows anybody else's."""

    queryset = Listing.objects.none()
    filterset_fields = ["status"]
    ordering_fields = ["created_at", "asking_price"]
    ordering = ["-created_at"]
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_serializer_class(self):
        if self.action in ("create", "partial_update", "update"):
            return ListingWriteSerializer
        return MyListingSerializer

    def get_queryset(self):
        return (
            Listing.objects.filter(seller=self.request.user)
            .select_related(*ITEM_JOINS)
            .annotate(
                enquiries_total=Count("enquiries", distinct=True),
                enquiries_waiting=Count(
                    "enquiries",
                    filter=Q(enquiries__status=Enquiry.Status.SENT),
                    distinct=True,
                ),
            )
        )

    def perform_create(self, serializer):
        # The city defaults to the seller's own, because most people are
        # selling something that is wherever they are.
        city = serializer.validated_data.get("city") or (self.request.user.city or "")

        # Most people sell their own clothes, so the seller's usual section is
        # the sensible starting point. "Everything" says nothing useful about
        # one garment, so that becomes "not stated" rather than a wrong guess.
        chosen = serializer.validated_data.get("audience")
        if not chosen or chosen == Listing.Audience.UNKNOWN:
            usual = self.request.user.shopping_for
            chosen = usual if usual in Listing.Audience.values else Listing.Audience.UNKNOWN

        try:
            with transaction.atomic():
                listing = serializer.save(
                    seller=self.request.user, city=city, audience=chosen
                )
        except IntegrityError as exc:
            raise ValidationError({"item": "That one is already up for sale."}) from exc

        GarmentItem.objects.filter(pk=listing.item_id).update(
            status=GarmentItem.Status.FOR_SALE
        )

    @extend_schema(tags=["Marketplace"], summary="Mark it sold", request=None,
                   responses={200: MyListingSerializer})
    @action(detail=True, methods=["post"], url_path="sold")
    def mark_sold(self, request, pk=None):
        listing = self.get_object()
        if not listing.is_open:
            raise ValidationError({"status": "That one is already closed."})
        listing.mark_sold()
        return Response(MyListingSerializer(self.get_queryset().get(pk=listing.pk),
                                            context={"request": request}).data)

    @extend_schema(tags=["Marketplace"], summary="Take it down and keep the garment",
                   request=None, responses={200: MyListingSerializer})
    @action(detail=True, methods=["post"])
    def withdraw(self, request, pk=None):
        listing = self.get_object()
        if not listing.is_open:
            raise ValidationError({"status": "That one is already closed."})
        listing.withdraw()
        return Response(MyListingSerializer(self.get_queryset().get(pk=listing.pk),
                                            context={"request": request}).data)

    @extend_schema(tags=["Marketplace"], summary="Requests people have sent me for this one",
                   responses={200: EnquirySerializer(many=True)})
    @action(detail=True, methods=["get"])
    def enquiries(self, request, pk=None):
        listing = self.get_object()
        rows = listing.enquiries.select_related("buyer", "listing", "listing__seller").all()
        return Response(EnquirySerializer(rows, many=True, context={"request": request}).data)

    def perform_destroy(self, instance):
        # Deleting a live listing puts the garment back rather than leaving it
        # marked for sale with nothing selling it.
        if instance.is_open:
            GarmentItem.objects.filter(pk=instance.item_id).update(
                status=GarmentItem.Status.IN_WARDROBE
            )
        instance.delete()


@extend_schema(
    tags=["Marketplace"],
    summary="What this garment might fetch",
    parameters=[
        OpenApiParameter("item", int, required=True, description="A garment of your own"),
        OpenApiParameter("condition", str, description="NEW, LIKE_NEW, GOOD or WORN"),
    ],
    responses=PriceSuggestionSerializer,
)
class PriceSuggestionView(APIView):
    """
    A starting price, worked out from what the garment cost and how worn it is.

    Never invented: with no purchase price recorded it says so and offers
    nothing, because a made-up figure is worse than an empty box.
    """

    def get(self, request):
        item_id = request.query_params.get("item")
        condition = (request.query_params.get("condition") or Listing.Condition.GOOD).upper()

        if condition not in Listing.Condition.values:
            raise ValidationError({"condition": "That is not one of the conditions."})

        item = GarmentItem.objects.filter(pk=item_id, owner=request.user).first()
        if item is None:
            raise ValidationError({"item": "No such item in your closet."})

        # Through the serializer so the money fields arrive as strings such as
        # "1000.00", exactly as the API docs promise, not as bare numbers.
        return Response(PriceSuggestionSerializer(suggestion_for(item, condition)).data)


@extend_schema_view(
    list=extend_schema(tags=["Marketplace"], summary="Requests I have sent"),
)
class MyEnquiryViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    """The buyer's side: what I asked for, and what came of it."""

    queryset = Enquiry.objects.none()
    serializer_class = EnquirySerializer
    filterset_fields = ["status"]
    ordering = ["-created_at"]

    def get_queryset(self):
        return Enquiry.objects.filter(buyer=self.request.user).select_related(
            "listing", "listing__item", "listing__item__category", "listing__seller", "buyer"
        )

    @extend_schema(
        tags=["Marketplace"],
        summary="Change my mind about a request",
        description=(
            "The request is removed rather than marked as withdrawn, so the "
            "listing goes back to offering the button and the same person can "
            "ask again another day."
        ),
        request=None,
        responses={204: None},
    )
    @action(detail=True, methods=["post"])
    def withdraw(self, request, pk=None):
        enquiry = self.get_object()
        if enquiry.status != Enquiry.Status.SENT:
            raise ValidationError({"status": "That request has already been answered."})
        enquiry.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


@extend_schema_view(
    list=extend_schema(
        tags=["Marketplace"],
        summary="Requests people have sent me",
        description=(
            "Every request across all of my listings. Accepting one shows both "
            "sides how to reach each other; until then neither has the other's "
            "details."
        ),
    ),
)
class ReceivedEnquiryViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    """The seller's side: who wants what, and answering them."""

    queryset = Enquiry.objects.none()
    serializer_class = EnquirySerializer
    filterset_fields = ["status"]
    ordering = ["-created_at"]

    def get_queryset(self):
        return Enquiry.objects.filter(listing__seller=self.request.user).select_related(
            "listing", "listing__item", "listing__item__category", "listing__seller", "buyer"
        )

    def _answer(self, request, pk, decide):
        enquiry = self.get_object()
        if enquiry.status != Enquiry.Status.SENT:
            raise ValidationError({"status": "That request has already been answered."})
        if not enquiry.listing.is_open:
            raise ValidationError({"status": "That listing is no longer for sale."})
        decide(enquiry)
        return Response(EnquirySerializer(enquiry, context={"request": request}).data)

    @extend_schema(tags=["Marketplace"], summary="Say yes, which shares contact details both ways",
                   request=None, responses={200: EnquirySerializer})
    @action(detail=True, methods=["post"])
    def accept(self, request, pk=None):
        return self._answer(request, pk, lambda enquiry: enquiry.accept())

    @extend_schema(tags=["Marketplace"], summary="Say no", request=None,
                   responses={200: EnquirySerializer})
    @action(detail=True, methods=["post"])
    def decline(self, request, pk=None):
        return self._answer(request, pk, lambda enquiry: enquiry.decline())


@extend_schema_view(
    list=extend_schema(tags=["Marketplace"], summary="People I have blocked"),
    create=extend_schema(tags=["Marketplace"], summary="Block somebody"),
    destroy=extend_schema(tags=["Marketplace"], summary="Unblock somebody"),
)
class BlockViewSet(
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    """A block hides listings in both directions and refuses enquiries."""

    queryset = Block.objects.none()

    serializer_class = BlockSerializer

    def get_queryset(self):
        return Block.objects.filter(blocker=self.request.user).select_related("blocked")

    def perform_create(self, serializer):
        try:
            serializer.save(blocker=self.request.user)
        except IntegrityError as exc:
            raise ValidationError({"blocked": "You have already blocked them."}) from exc


@extend_schema(tags=["Marketplace"], summary="What the marketplace holds right now",
               responses=MarketplaceStatsSerializer)
class MarketplaceStatsView(APIView):
    def get(self, request):
        open_listings = Listing.objects.visible_to(request.user)
        return Response({
            "listings_open": open_listings.count(),
            "cities": open_listings.exclude(city="").values("city").distinct().count(),
            "my_listings": Listing.objects.filter(
                seller=request.user, status__in=Listing.OPEN_STATUSES
            ).count(),
            "enquiries_waiting_on_me": Enquiry.objects.filter(
                listing__seller=request.user, status=Enquiry.Status.SENT
            ).count(),
            "my_enquiries_answered": Enquiry.objects.filter(
                buyer=request.user, status=Enquiry.Status.ACCEPTED
            ).count(),
        })
