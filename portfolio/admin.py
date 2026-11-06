from django.contrib import admin
from django import forms

from .models import (
    ArtistProfile,
    BackgroundFrame,
    Category,
    Reference,
    ReferenceLink,
    SocialLink,
    Work,
    WorkImage,
    WorkVideo,
)
from .youtube import YouTubeMetadataError, fetch_youtube_video_metadata


@admin.register(ArtistProfile)
class ArtistProfileAdmin(admin.ModelAdmin):
    fields = (
        "name",
        "tagline",
        "photo",
        "photo_url",
        "bio",
        "instagram_url",
        "contact_email",
        "contact_form_url",
    )

    def has_add_permission(self, request):
        return not ArtistProfile.objects.exists()

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(SocialLink)
class SocialLinkAdmin(admin.ModelAdmin):
    list_display = ("title", "url", "position", "is_active")
    list_editable = ("position", "is_active")
    ordering = ("position", "id")
    search_fields = ("title", "url")


@admin.register(BackgroundFrame)
class BackgroundFrameAdmin(admin.ModelAdmin):
    list_display = ("__str__", "position", "is_active")
    list_editable = ("position", "is_active")
    ordering = ("position", "id")


class WorkInline(admin.StackedInline):
    model = Work
    extra = 0
    fields = ("title", "image", "image_url", "description", "detail", "position", "is_active")


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ("title", "key", "position", "is_active")
    list_editable = ("position", "is_active")
    search_fields = ("title", "key")
    inlines = (WorkInline,)


@admin.register(WorkImage)
class WorkImageAdmin(admin.ModelAdmin):
    list_display = ("work", "position", "image")
    list_filter = ("work__category",)
    list_select_related = ("work", "work__category")
    ordering = ("work__category__position", "work__position", "position", "id")
    search_fields = ("work__title",)


class WorkVideoAdminForm(forms.ModelForm):
    class Meta:
        model = WorkVideo
        fields = ("work", "youtube_url", "position")

    def clean(self):
        cleaned_data = super().clean()
        youtube_url = cleaned_data.get("youtube_url")
        instance = self.instance
        if youtube_url and (
            not instance.pk
            or youtube_url != instance.youtube_url
            or not instance.video_id
        ):
            try:
                cleaned_data["youtube_metadata"] = fetch_youtube_video_metadata(youtube_url)
            except YouTubeMetadataError as error:
                self.add_error("youtube_url", str(error))
        return cleaned_data


@admin.register(WorkVideo)
class WorkVideoAdmin(admin.ModelAdmin):
    form = WorkVideoAdminForm
    list_display = ("work", "video_title", "position")
    list_filter = ("work__category",)
    list_select_related = ("work", "work__category")
    list_editable = ("position",)
    ordering = ("work__category__position", "work__position", "position", "id")
    search_fields = ("work__title", "video_title", "video_id")

    def save_model(self, request, obj, form, change):
        metadata = form.cleaned_data.get("youtube_metadata")
        if metadata:
            obj.video_id = metadata["video_id"]
            obj.video_title = metadata["title"]
            obj.thumbnail_url = metadata["thumbnail_url"]
        super().save_model(request, obj, form, change)


class ReferenceLinkInline(admin.TabularInline):
    model = ReferenceLink
    extra = 0
    fields = ("text", "url", "position")


@admin.register(Reference)
class ReferenceAdmin(admin.ModelAdmin):
    list_display = ("title", "period", "position", "is_active")
    list_editable = ("position", "is_active")
    search_fields = ("title", "period")
    inlines = (ReferenceLinkInline,)