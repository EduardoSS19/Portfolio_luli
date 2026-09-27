from django.contrib import admin
from django.urls import include, path

from portfolio.views import frontend, healthcheck


urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/health/", healthcheck, name="healthcheck"),
    path("api/", include("portfolio.urls")),
    path("", frontend, name="frontend"),
]