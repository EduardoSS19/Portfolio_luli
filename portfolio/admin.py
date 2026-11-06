from django.contrib import admin

from .models import (
    ArtistProfile,
    BackgroundFrame,
    Category,
    Reference,
    ReferenceLink,
    SocialLink,
    Work,
    WorkImage,
)


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