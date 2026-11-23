from django.urls import path

from .views import manage_template_detail, manage_templates, published_templates


urlpatterns = [
    path("templates/", published_templates, name="studio-published-templates"),
    path("manage/templates/", manage_templates, name="studio-manage-templates"),
    path("manage/templates/<int:template_id>/", manage_template_detail, name="studio-manage-template-detail"),
]
