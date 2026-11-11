from django.urls import path

from .cms_api import cms_overview, cms_work_cover_upload, cms_work_create, cms_work_gallery, cms_work_gallery_delete, cms_work_update, cms_works
from .views import contact, portfolio_data


urlpatterns = [
    path("portfolio/", portfolio_data, name="portfolio-data"),
    path("contact/", contact, name="contact"),
    path("cms/overview/", cms_overview, name="cms-overview"),
    path("cms/works/", cms_works, name="cms-works"),
    path("cms/works/create/", cms_work_create, name="cms-work-create"),
    path("cms/works/<int:work_id>/", cms_work_update, name="cms-work-update"),
    path("cms/works/<int:work_id>/cover/", cms_work_cover_upload, name="cms-work-cover-upload"),
    path("cms/works/<int:work_id>/gallery/", cms_work_gallery, name="cms-work-gallery"),
    path("cms/works/<int:work_id>/gallery/<int:image_id>/delete/", cms_work_gallery_delete, name="cms-work-gallery-delete"),
]