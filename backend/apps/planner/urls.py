from django.urls import path

from .views import TodayView

app_name = "planner"

urlpatterns = [
    path("today/", TodayView.as_view(), name="today"),
]
