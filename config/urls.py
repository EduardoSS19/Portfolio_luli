from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path

from portfolio.views import frontend, healthcheck


urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/health/", healthcheck, name="healthcheck"),
    path("api/", include("portfolio.urls")),
    path("", frontend, name="frontend"),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)