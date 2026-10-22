from django.db.models import Count, Q
from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework import generics, permissions, serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView

from .serializers import LoginSerializer, RegisterSerializer, UserSerializer


@extend_schema(
    tags=["Auth"],
    summary="Open an account and sign in straight away",
    description=(
        "Returns the access and refresh tokens along with the new account, so "
        "the client never re-posts the credentials it has just sent."
    ),
)
class RegisterView(generics.CreateAPIView):
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]
    throttle_scope = "signup"

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        # Signing up also signs the person in. The browser gets its tokens here,
        # so it never has to send the password a second time.
        refresh = RefreshToken.for_user(user)
        return Response(
            {
                "user": UserSerializer(user).data,
                "access": str(refresh.access_token),
                "refresh": str(refresh),
            },
            status=status.HTTP_201_CREATED,
        )


@extend_schema(tags=["Auth"])
class LoginView(TokenObtainPairView):
    serializer_class = LoginSerializer
    permission_classes = [permissions.AllowAny]
    throttle_scope = "login"


@extend_schema(tags=["Auth"])
class MeView(generics.RetrieveUpdateAPIView):
    """Always works on the signed-in account. There is no way to ask for anybody else's."""

    serializer_class = UserSerializer

    def get_object(self):
        return self.request.user


class WaitingSerializer(serializers.Serializer):
    """Counts of everything waiting for an answer, used to draw the red badges."""

    friend_requests = serializers.IntegerField()
    borrow_asks = serializers.IntegerField()
    buy_requests = serializers.IntegerField()
    overdue = serializers.IntegerField()
    total = serializers.IntegerField()


@extend_schema(
    tags=["Account"],
    summary="How many things are waiting for an answer",
    responses={200: WaitingSerializer},
)
class WaitingView(APIView):
    """
    One small request the whole app repeats every so often, instead of four
    pages each asking their own question. It returns numbers only, no names and
    no items, because the answer is almost always zero and anything more would
    be wasted work.
    """

    def get(self, request):
        # Imported inside the function on purpose. The accounts app loads before
        # the friends and marketplace apps, and importing them at the top of
        # this file would make the apps depend on each other for one view.
        from apps.circle.models import FriendRequest, Loan
        from apps.community.models import Enquiry

        me = request.user
        today = timezone.localdate()

        # Two database questions instead of five. The loans table is asked once
        # and returns both of its counts in the same answer.
        loans = Loan.objects.aggregate(
            asks=Count("id", filter=Q(lender=me, status=Loan.Status.ASKED)),
            overdue=Count(
                "id",
                filter=Q(borrower=me, status=Loan.Status.AGREED, borrow_until__lt=today),
            ),
        )
        friend_requests = FriendRequest.objects.filter(
            to_user=me, status=FriendRequest.Status.SENT
        ).count()
        buy_requests = Enquiry.objects.filter(
            listing__seller=me, status=Enquiry.Status.SENT
        ).count()

        waiting = {
            "friend_requests": friend_requests,
            "borrow_asks": loans["asks"],
            "buy_requests": buy_requests,
            "overdue": loans["overdue"],
        }
        # Overdue loans are reported but kept out of the total. Nobody is
        # waiting for an answer on them, so they do not belong in the badge.
        waiting["total"] = friend_requests + loans["asks"] + buy_requests
        return Response(waiting)
