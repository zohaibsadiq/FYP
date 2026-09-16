from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import DealViewSet, FilterOptionsView, FreshnessView

app_name = "shopping"

router = DefaultRouter()
router.register("deals", DealViewSet, basename="deal")

urlpatterns = [
    path("freshness/", FreshnessView.as_view(), name="freshness"),
    path("filters/", FilterOptionsView.as_view(), name="filters"),
    path("", include(router.urls)),
]
