from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import PlannedOutfitViewSet, TodayView

app_name = "planner"

router = DefaultRouter()
router.register("outfits", PlannedOutfitViewSet, basename="outfit")

urlpatterns = [
    path("today/", TodayView.as_view(), name="today"),
    path("", include(router.urls)),
]
