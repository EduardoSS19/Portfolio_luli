from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path, re_path

from portfolio.views import frontend, healthcheck


urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/health/", healthcheck, name="healthcheck"),
    path("api/", include("portfolio.urls")),
    path("painel", frontend, name="cms-frontend"),
    path("painel/", frontend, name="cms-frontend-slash"),
    path("", frontend, name="frontend"),
    # The React portfolio renderer owns artist-created pages such as /sobre and /projetos.
    # Keep API, admin, CMS, and static/media namespaces out of this catch-all.
    re_path(r"^(?!api/|admin/|painel/?$|static/|media/|assets/|favicon\.ico$|robots\.txt$|sitemap\.xml$).+$", frontend, name="portfolio-page"),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)