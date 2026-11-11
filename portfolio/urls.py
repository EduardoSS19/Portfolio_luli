from django.urls import path

from .cms_api import cms_overview, cms_works
from .views import contact, portfolio_data


urlpatterns = [
    path("portfolio/", portfolio_data, name="portfolio-data"),
    path("contact/", contact, name="contact"),
    path("cms/overview/", cms_overview, name="cms-overview"),
    path("cms/works/", cms_works, name="cms-works"),
]