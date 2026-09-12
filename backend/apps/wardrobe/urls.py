"""
Wardrobe URLs, mounted at /api/wardrobe/ by config/urls.py.

DefaultRouter generates the standard REST routes for each ViewSet, so we do not
hand-write ten paths:

    GET    /items/          list
    POST   /items/          create
    GET    /items/{id}/     retrieve
    PATCH  /items/{id}/     update
    DELETE /items/{id}/     delete

plus one route for every @action we defined, e.g. /items/{id}/mark-worn/
"""

from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    CategoryViewSet,
    GarmentImageUploadView,
    GarmentItemViewSet,
    StorageLocationViewSet,
)

app_name = "wardrobe"

router = DefaultRouter()
router.register("items", GarmentItemViewSet, basename="item")
router.register("categories", CategoryViewSet, basename="category")
router.register("storage", StorageLocationViewSet, basename="storage")

urlpatterns = [
    # Not part of the router because it is not CRUD on a model - it is a
    # processing step that returns image URLs.
    path("upload/", GarmentImageUploadView.as_view(), name="upload"),
    path("", include(router.urls)),
]
