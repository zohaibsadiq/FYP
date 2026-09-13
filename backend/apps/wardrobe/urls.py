from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    CategoryViewSet,
    GarmentImageDiscardView,
    GarmentImageUploadView,
    GarmentItemViewSet,
    StorageLocationViewSet,
    WearEventViewSet,
)

app_name = "wardrobe"

router = DefaultRouter()
router.register("items", GarmentItemViewSet, basename="item")
router.register("categories", CategoryViewSet, basename="category")
router.register("storage", StorageLocationViewSet, basename="storage")
router.register("wears", WearEventViewSet, basename="wear")

urlpatterns = [
    # Outside the router: this one processes an image and returns URLs instead
    # of acting on a model.
    path("upload/", GarmentImageUploadView.as_view(), name="upload"),
    path("upload/discard/", GarmentImageDiscardView.as_view(), name="upload-discard"),
    path("", include(router.urls)),
]
