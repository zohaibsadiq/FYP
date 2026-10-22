from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView


def health(request):
    """Render calls this every few seconds to check the service is alive."""
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
    path("api/planner/", include("apps.planner.urls")),
    path("api/shopping/", include("apps.shopping.urls")),
    path("api/market/", include("apps.community.urls")),
    path("api/friends/", include("apps.circle.urls")),
    path("api/try-on/", include("apps.tryon.urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
