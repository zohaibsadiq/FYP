from __future__ import annotations

from django.db import IntegrityError, transaction
from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.wardrobe.models import GarmentItem

from .models import Friend, FriendRequest, Loan
from .serializers import (
    AcceptRequestSerializer,
    AskToBorrowSerializer,
    CircleStatsSerializer,
    FriendRequestSerializer,
    FriendSerializer,
    GarmentToBorrowSerializer,
    LoanSerializer,
    MyCodeSerializer,
    SendRequestSerializer,
    lendable_items,
)


def unique_nickname(owner, wanted: str) -> str:
    """
    Settles a name clash without stopping somebody mid-tap: "Ali Khan" becomes
    "Ali Khan (2)".

    Only used where a name was not typed in by hand. Where one was, the
    serializer refuses and asks for a different one, because silently renaming
    somebody's friend would be worse than a clear error.
    """
    wanted = (wanted or "").strip() or "Friend"
    if not Friend.objects.filter(owner=owner, nickname__iexact=wanted).exists():
        return wanted

    for n in range(2, 200):
        candidate = f"{wanted} ({n})"
        if not Friend.objects.filter(owner=owner, nickname__iexact=candidate).exists():
            return candidate
    raise ValidationError({"nickname": "Give this friend a name of your own."})


def label_for(owner, person) -> str:
    """
    The name a new friend starts with. Their own name where that is free, or
    their name plus their city where it is not, such as "Ali Khan (Lahore)", so
    a list never shows the same words twice.
    """
    base = person.display_name
    if not Friend.objects.filter(owner=owner, nickname__iexact=base).exists():
        return base
    if person.city:
        with_city = f"{base} ({person.city})"
        if not Friend.objects.filter(owner=owner, nickname__iexact=with_city).exists():
            return with_city
    return unique_nickname(owner, base)


@extend_schema(
    tags=["Friends"],
    summary="Your own code, and a new one when you want it",
    request=None,
    responses={200: MyCodeSerializer},
)
class MyCodeView(APIView):
    """
    The code is made the first time it is looked at. Accounts created before
    this feature existed have none until their owner opens the page.
    """

    def get(self, request):
        return Response({
            "code": request.user.ensure_friend_code(),
            "shares_closet": request.user.shares_closet,
        })

    def post(self, request):
        return Response({"code": request.user.reissue_friend_code()})


@extend_schema_view(
    list=extend_schema(tags=["Friends"], summary="People who asked to be your friend"),
    retrieve=extend_schema(tags=["Friends"], summary="One request somebody sent you"),
)
class FriendRequestViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = FriendRequestSerializer
    queryset = FriendRequest.objects.none()
    # Has to exist on the class before the by-code action below can set its
    # own value, or the framework rejects the setting.
    throttle_scope = None

    def get_queryset(self):
        return (
            FriendRequest.objects.filter(
                to_user=self.request.user, status=FriendRequest.Status.SENT
            )
            .select_related("from_user", "to_user")
        )

    @extend_schema(
        tags=["Friends"],
        summary="Ask somebody to be your friend, using the code they gave you",
        request=SendRequestSerializer,
        responses={201: FriendRequestSerializer},
    )
    @action(
        detail=False,
        methods=["post"],
        url_path="by-code",
        throttle_scope="friend-code",
    )
    def by_code(self, request):
        payload = SendRequestSerializer(data=request.data, context={"request": request})
        payload.is_valid(raise_exception=True)
        asked = payload.save()
        return Response(
            FriendRequestSerializer(asked).data, status=status.HTTP_201_CREATED
        )

    @extend_schema(
        tags=["Friends"],
        summary="Say yes, and choose what to call them",
        request=AcceptRequestSerializer,
        responses={201: FriendSerializer},
    )
    @action(detail=True, methods=["post"])
    def accept(self, request, pk=None):
        ask = self.get_object()
        payload = AcceptRequestSerializer(data=request.data, context={"request": request})
        payload.is_valid(raise_exception=True)
        typed = payload.validated_data.get("nickname", "")

        with transaction.atomic():
            ask.status = FriendRequest.Status.ACCEPTED
            ask.answered_at = timezone.now()
            ask.save(update_fields=["status", "answered_at"])

            mine, _ = Friend.objects.get_or_create(
                owner=request.user,
                person=ask.from_user,
                defaults={"nickname": typed or label_for(request.user, ask.from_user)},
            )
            # Their side is named automatically. They were not asked anything,
            # so a clash on their list is settled quietly rather than thrown at
            # them as an error.
            Friend.objects.get_or_create(
                owner=ask.from_user,
                person=request.user,
                defaults={"nickname": label_for(ask.from_user, request.user)},
            )

        return Response(
            FriendSerializer(mine, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )

    @extend_schema(tags=["Friends"], summary="Say no")
    @action(detail=True, methods=["post"])
    def decline(self, request, pk=None):
        ask = self.get_object()
        ask.status = FriendRequest.Status.DECLINED
        ask.answered_at = timezone.now()
        ask.save(update_fields=["status", "answered_at"])
        return Response(status=status.HTTP_204_NO_CONTENT)


@extend_schema_view(
    list=extend_schema(tags=["Friends"], summary="Your friends"),
    retrieve=extend_schema(tags=["Friends"], summary="One friend of yours"),
    partial_update=extend_schema(tags=["Friends"], summary="Rename or block a friend"),
    destroy=extend_schema(tags=["Friends"], summary="Remove a friend, both ways"),
)
class FriendViewSet(viewsets.ModelViewSet):
    serializer_class = FriendSerializer
    queryset = Friend.objects.none()
    http_method_names = ["get", "patch", "delete", "head", "options"]

    def get_queryset(self):
        return Friend.objects.filter(owner=self.request.user).select_related("person")

    def perform_update(self, serializer):
        try:
            serializer.save()
        except IntegrityError:
            raise ValidationError({"nickname": "You already have a friend called that."})

    def perform_destroy(self, instance: Friend):
        # Removed on both sides. Leaving their row behind would show them a
        # friend who cannot see them, which looks like a bug rather than a
        # choice.
        with transaction.atomic():
            Friend.objects.filter(
                Q(owner=instance.owner, person=instance.person)
                | Q(owner=instance.person, person=instance.owner)
            ).delete()

    @extend_schema(
        tags=["Friends"],
        summary="What this friend is offering to lend",
        responses={200: GarmentToBorrowSerializer(many=True)},
    )
    @action(detail=True, methods=["get"])
    def closet(self, request, pk=None):
        friend = self.get_object()
        if friend.blocked:
            raise ValidationError({"detail": "You have blocked them, so nothing is shown."})
        if not friend.person.shares_closet:
            raise ValidationError(
                {"detail": f"{friend.nickname} has not opened their closet to friends yet."}
            )
        # Same wording as the line above on purpose, so a person cannot tell
        # "they blocked me" apart from "they never opened their closet".
        if Friend.objects.filter(owner=friend.person, person=request.user, blocked=True).exists():
            raise ValidationError(
                {"detail": f"{friend.nickname} has not opened their closet to friends yet."}
            )

        return Response(
            GarmentToBorrowSerializer(lendable_items(friend.person), many=True).data
        )


@extend_schema_view(
    list=extend_schema(tags=["Friends"], summary="Everything lent, borrowed, or waiting"),
    retrieve=extend_schema(tags=["Friends"], summary="One loan, from either side"),
)
class LoanViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = LoanSerializer
    queryset = Loan.objects.none()

    def get_queryset(self):
        me = self.request.user
        return (
            Loan.objects.filter(Q(lender=me) | Q(borrower=me))
            .select_related("item", "item__category", "lender", "borrower")
        )

    def _mine_to_answer(self, pk) -> Loan:
        return get_object_or_404(Loan, pk=pk, lender=self.request.user)

    @extend_schema(
        tags=["Friends"],
        summary="Ask a friend for something of theirs",
        request=AskToBorrowSerializer,
        responses={201: LoanSerializer},
    )
    @action(detail=False, methods=["post"], url_path=r"ask/(?P<item_id>\d+)")
    def ask(self, request, item_id=None):
        item = get_object_or_404(GarmentItem, pk=item_id)
        friend = Friend.objects.filter(owner=request.user, person=item.owner).first()

        # Everything is checked again here instead of trusting the list the tap
        # came from, because that list may be minutes old and things change.
        if friend is None or friend.blocked:
            raise ValidationError({"detail": "That is not something a friend of yours is lending."})
        if not item.owner.shares_closet or not item.is_lendable:
            raise ValidationError({"detail": "That is not something a friend of yours is lending."})
        if Friend.objects.filter(owner=item.owner, person=request.user, blocked=True).exists():
            raise ValidationError({"detail": "That is not something a friend of yours is lending."})
        if item.status not in (GarmentItem.Status.IN_WARDROBE, GarmentItem.Status.IN_LAUNDRY):
            raise ValidationError({"detail": f"{item.name} is not free to lend right now."})
        if Loan.objects.filter(item=item, status__in=Loan.OPEN_STATUSES).exists():
            raise ValidationError({"detail": f"Somebody has already asked for {item.name}."})

        payload = AskToBorrowSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        loan = payload.save(item=item, lender=item.owner, borrower=request.user)
        return Response(
            LoanSerializer(loan, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )

    @extend_schema(tags=["Friends"], summary="Yes, they can borrow it")
    @action(detail=True, methods=["post"])
    def agree(self, request, pk=None):
        loan = self._mine_to_answer(pk)
        if loan.status != Loan.Status.ASKED:
            raise ValidationError({"status": "That request has already been answered."})
        if loan.item.status not in (GarmentItem.Status.IN_WARDROBE, GarmentItem.Status.IN_LAUNDRY):
            raise ValidationError({"status": f"{loan.item.name} is not free to lend any more."})
        loan.agree()
        return Response(LoanSerializer(loan, context={"request": request}).data)

    @extend_schema(tags=["Friends"], summary="No, not this time")
    @action(detail=True, methods=["post"])
    def decline(self, request, pk=None):
        loan = self._mine_to_answer(pk)
        if loan.status != Loan.Status.ASKED:
            raise ValidationError({"status": "That request has already been answered."})
        loan.status = Loan.Status.DECLINED
        loan.answered_at = timezone.now()
        loan.save(update_fields=["status", "answered_at"])
        return Response(LoanSerializer(loan, context={"request": request}).data)

    @extend_schema(tags=["Friends"], summary="It came back")
    @action(detail=True, methods=["post"], url_path="returned")
    def returned(self, request, pk=None):
        loan = self._mine_to_answer(pk)
        if loan.status != Loan.Status.AGREED:
            raise ValidationError({"status": "That one is not out on loan."})
        loan.give_back()
        return Response(LoanSerializer(loan, context={"request": request}).data)

    @extend_schema(tags=["Friends"], summary="Take back a request you sent")
    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        loan = get_object_or_404(Loan, pk=pk, borrower=request.user)
        if loan.status != Loan.Status.ASKED:
            raise ValidationError({"status": "That request has already been answered."})
        # Deleted rather than kept. Leaving a cancelled row behind would block
        # asking again, because only one open loan per garment is allowed.
        loan.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


@extend_schema(
    tags=["Friends"],
    summary="The few numbers the page opens with",
    responses={200: CircleStatsSerializer},
)
class CircleStatsView(APIView):
    def get(self, request):
        me = request.user
        mine = Loan.objects.filter(lender=me)
        theirs = Loan.objects.filter(borrower=me)
        return Response({
            "friends": Friend.objects.filter(owner=me, blocked=False).count(),
            "requests_waiting": FriendRequest.objects.filter(
                to_user=me, status=FriendRequest.Status.SENT
            ).count(),
            "asks_waiting_on_me": mine.filter(status=Loan.Status.ASKED).count(),
            "lent_out": mine.filter(status=Loan.Status.AGREED).count(),
            "borrowed": theirs.filter(status=Loan.Status.AGREED).count(),
            "overdue": theirs.filter(
                status=Loan.Status.AGREED, borrow_until__lt=timezone.localdate()
            ).count(),
        })
