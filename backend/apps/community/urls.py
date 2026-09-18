from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    BlockViewSet,
    ListingViewSet,
    MarketplaceStatsView,
    MyEnquiryViewSet,
    MyListingViewSet,
    PriceSuggestionView,
    ReceivedEnquiryViewSet,
)

app_name = "community"

router = DefaultRouter()
router.register("listings", ListingViewSet, basename="listing")
router.register("my-listings", MyListingViewSet, basename="my-listing")
router.register("my-enquiries", MyEnquiryViewSet, basename="my-enquiry")
router.register("enquiries-received", ReceivedEnquiryViewSet, basename="enquiry-received")
router.register("blocks", BlockViewSet, basename="block")

urlpatterns = [
    path("price-suggestion/", PriceSuggestionView.as_view(), name="price-suggestion"),
    path("stats/", MarketplaceStatsView.as_view(), name="stats"),
    path("", include(router.urls)),
]
