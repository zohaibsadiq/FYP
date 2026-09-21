from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    CircleStatsView,
    FriendRequestViewSet,
    FriendViewSet,
    LoanViewSet,
    MyCodeView,
)

router = DefaultRouter()
router.register("requests", FriendRequestViewSet, basename="friend-request")
router.register("loans", LoanViewSet, basename="loan")
router.register("", FriendViewSet, basename="friend")

urlpatterns = [
    path("my-code/", MyCodeView.as_view(), name="friend-code"),
    path("stats/", CircleStatsView.as_view(), name="circle-stats"),
    path("", include(router.urls)),
]
