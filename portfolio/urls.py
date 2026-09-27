from django.urls import path

from .views import portfolio_data


urlpatterns = [
    path("portfolio/", portfolio_data, name="portfolio-data"),
]