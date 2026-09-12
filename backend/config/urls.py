from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView


def health(request):
    """Liveness probe polled by the hosting platform."""
    return JsonResponse({"status": "ok", "service": "closette-api"})


urlpatterns = [
    path("admin/", admin.site.urls),

    path("api/health/", health, name="health"),

    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path(
        "api/docs/",
        SpectacularSwaggerView.as_view(url_name="schema"),
        name="swagger-ui",
    ),

    path("api/auth/", include("apps.accounts.urls")),
    path("api/wardrobe/", include("apps.wardrobe.urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
