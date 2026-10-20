import pytest
from rest_framework.test import APIClient

from apps.wardrobe.models import Category


@pytest.fixture
def api():
    return APIClient()


@pytest.fixture
def make_user(django_user_model):
    def build(email, password="Test-pass-9273", **extra):
        return django_user_model.objects.create_user(email=email, password=password, **extra)

    return build


@pytest.fixture
def signed_in(api, make_user):
    """Returns a client already carrying a token, plus the account behind it."""

    def build(email="person@example.test", password="Test-pass-9273", **extra):
        user = make_user(email, password, **extra)
        client = APIClient()
        response = client.post(
            "/api/auth/login/", {"email": email, "password": password}, format="json"
        )
        assert response.status_code == 200, response.data
        client.credentials(HTTP_AUTHORIZATION="Bearer " + response.data["access"])
        return client, user

    return build


@pytest.fixture
def shirt_category(db):
    return Category.objects.filter(owner__isnull=True, name="Shirt").first() or Category.objects.create(
        name="Shirt", slot=Category.Slot.TOP
    )
