from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import BodyPhotoView, TryOnStatusView, TryOnViewSet

router = DefaultRouter()
router.register("", TryOnViewSet, basename="tryon")

urlpatterns = [
    path("body-photo/", BodyPhotoView.as_view(), name="body-photo"),
    path("status/", TryOnStatusView.as_view(), name="tryon-status"),
    path("", include(router.urls)),
]
