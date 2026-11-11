from django.urls import path

from .cms_analytics import cms_analytics
from .cms_content_api import cms_content, cms_content_detail, cms_content_toggle

from .cms_api import cms_overview, cms_work_cover_upload, cms_work_create, cms_work_gallery, cms_work_gallery_delete, cms_work_video_delete, cms_work_videos, cms_work_update, cms_work_preview, cms_work_publish, cms_work_bulk_publish, cms_work_delete, cms_works, cms_categories, cms_category_update, cms_profile, cms_profile_photo_upload
from .views import contact, portfolio_data


urlpatterns = [
    path("portfolio/", portfolio_data, name="portfolio-data"),
    path("contact/", contact, name="contact"),
    path("cms/overview/", cms_overview, name="cms-overview"),
    path("cms/content/", cms_content, name="cms-content"),
    path("cms/content/<str:content_type>/<int:item_id>/", cms_content_detail, name="cms-content-detail"),
    path("cms/content/<str:content_type>/<int:item_id>/toggle/", cms_content_toggle, name="cms-content-toggle"),
    path("cms/profile/", cms_profile, name="cms-profile"),
    path("cms/profile/photo/", cms_profile_photo_upload, name="cms-profile-photo-upload"),
    path("cms/analytics/", cms_analytics, name="cms-analytics"),
    path("cms/works/", cms_works, name="cms-works"),
    path("cms/categories/", cms_categories, name="cms-categories"),
    path("cms/categories/<int:category_id>/", cms_category_update, name="cms-category-update"),
    path("cms/works/create/", cms_work_create, name="cms-work-create"),
    path("cms/works/bulk-publish/", cms_work_bulk_publish, name="cms-work-bulk-publish"),
    path("cms/works/<int:work_id>/delete/", cms_work_delete, name="cms-work-delete"),
    path("cms/works/<int:work_id>/", cms_work_update, name="cms-work-update"),
    path("cms/works/<int:work_id>/preview/", cms_work_preview, name="cms-work-preview"),
    path("cms/works/<int:work_id>/publish/", cms_work_publish, name="cms-work-publish"),
    path("cms/works/<int:work_id>/cover/", cms_work_cover_upload, name="cms-work-cover-upload"),
    path("cms/works/<int:work_id>/gallery/", cms_work_gallery, name="cms-work-gallery"),
    path("cms/works/<int:work_id>/gallery/<int:image_id>/delete/", cms_work_gallery_delete, name="cms-work-gallery-delete"),
    path("cms/works/<int:work_id>/videos/", cms_work_videos, name="cms-work-videos"),
    path("cms/works/<int:work_id>/videos/<int:video_id>/delete/", cms_work_video_delete, name="cms-work-video-delete"),
]