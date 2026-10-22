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
    # Kept outside the router. This one takes an image, processes it and
    # returns web addresses; it does not act on a database row.
    path("upload/", GarmentImageUploadView.as_view(), name="upload"),
    path("upload/discard/", GarmentImageDiscardView.as_view(), name="upload-discard"),
    path("", include(router.urls)),
]
