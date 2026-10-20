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

        # Registration issues tokens itself so the client never re-posts the
        # credentials it just sent.
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
    """Resolves to request.user, so the endpoint cannot address another account."""

    serializer_class = UserSerializer

    def get_object(self):
        return self.request.user


class WaitingSerializer(serializers.Serializer):
    """Everything sitting unanswered, so a badge can be drawn without guessing."""

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
    One small call the whole app polls, rather than four pages each asking
    their own question. It is deliberately counts only: no names, no items,
    nothing that would be wasted work when the answer is almost always zero.
    """

    def get(self, request):
        # Imported here rather than at the top: accounts loads before the apps
        # these live in, and a module-level import would tie the two together
        # for the sake of one endpoint.
        from apps.circle.models import FriendRequest, Loan
        from apps.community.models import Enquiry

        me = request.user
        today = timezone.localdate()

        # Two queries, not five: each model is asked once and counts several
        # things at the same time.
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
        # Overdue loans are reported separately: nobody is waiting on an answer
        # for them, so they do not belong in the badge count.
        waiting["total"] = friend_requests + loans["asks"] + buy_requests
        return Response(waiting)
