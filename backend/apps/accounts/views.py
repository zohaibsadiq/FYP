"""
Views = the actual API endpoints. Each class below becomes one URL.

DRF gives us ready-made base classes so we write almost no code:
  CreateAPIView        -> handles POST
  RetrieveUpdateAPIView -> handles GET and PATCH
"""

from drf_spectacular.utils import extend_schema
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView

from .serializers import LoginSerializer, RegisterSerializer, UserSerializer


@extend_schema(tags=["Auth"])
class RegisterView(generics.CreateAPIView):
    """
    POST /api/auth/register/

    AllowAny because a brand-new user obviously has no token yet.
    (Remember: settings.py made every endpoint login-required by default,
    so we must opt out here explicitly.)
    """

    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        # Log them in immediately after signup so they are not asked to type
        # their password a second time.
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
    """
    POST /api/auth/login/   body: {"email": "...", "password": "..."}
    Returns: {access, refresh, user}
    """

    serializer_class = LoginSerializer
    permission_classes = [permissions.AllowAny]


@extend_schema(tags=["Auth"])
class MeView(generics.RetrieveUpdateAPIView):
    """
    GET   /api/auth/me/   -> who am I
    PATCH /api/auth/me/   -> update my city, name, or body photo

    There is no "pk" in the URL on purpose: a user can only ever read or edit
    their OWN profile. get_object() always returns request.user, so it is
    impossible to fetch someone else's data through this endpoint.
    """

    serializer_class = UserSerializer

    def get_object(self):
        return self.request.user
