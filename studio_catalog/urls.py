from django.urls import path

from .views import published_templates


urlpatterns = [
    path("templates/", published_templates, name="studio-published-templates"),
]
