"""
Main URL map for the whole backend.

Every feature app gets its own prefix under /api/. As we build each phase we
just add one line here. Nothing else in the project needs to change.
"""

from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView


def health(request):
    """
    GET /api/health/
    A tiny endpoint that returns {"status": "ok"}. Render and Vercel ping this
    to check the server is alive, and it is the fastest way to confirm your
    deployment worked.
    """
    return JsonResponse({"status": "ok", "service": "smart-wardrobe-api"})


urlpatterns = [
    # ---- Django's built-in admin panel (great for adding test data fast) ----
    path("admin/", admin.site.urls),

    # ---- Health check ----
    path("api/health/", health, name="health"),

    # ---- Interactive API documentation ----
    # Open http://localhost:8000/api/docs/ and you can test every endpoint in
    # the browser. This is also a screenshot worth putting in your thesis.
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path(
        "api/docs/",
        SpectacularSwaggerView.as_view(url_name="schema"),
        name="swagger-ui",
    ),

    # ---- Feature apps ----
    path("api/auth/", include("apps.accounts.urls")),
    path("api/wardrobe/", include("apps.wardrobe.urls")),
    # Phase 3: path("api/planner/",  include("apps.planner.urls")),
    # Phase 4: path("api/outfits/",  include("apps.outfits.urls")),
    # Phase 5: path("api/vision/",   include("apps.vision.urls")),
    # Phase 6: path("api/community/", include("apps.community.urls")),
]

# In development, let Django serve uploaded images from the media/ folder.
# In production Cloudinary handles this instead.
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
