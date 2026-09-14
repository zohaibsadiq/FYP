from django.urls import path

from .views import CopyLookView

app_name = "intelligence"

urlpatterns = [
    path("look/", CopyLookView.as_view(), name="copy-look"),
]
