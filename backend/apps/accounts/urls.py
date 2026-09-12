"""
URLs for the accounts app.

These get attached under /api/auth/ by config/urls.py, so:
    register/  ->  /api/auth/register/
"""

from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView, TokenVerifyView

from .views import LoginView, MeView, RegisterView

app_name = "accounts"

urlpatterns = [
    path("register/", RegisterView.as_view(), name="register"),
    path("login/", LoginView.as_view(), name="login"),
    # When the 60-minute access token expires, the frontend silently posts the
    # refresh token here and gets a fresh access token. The user never notices.
    path("refresh/", TokenRefreshView.as_view(), name="token-refresh"),
    path("verify/", TokenVerifyView.as_view(), name="token-verify"),
    path("me/", MeView.as_view(), name="me"),
]
