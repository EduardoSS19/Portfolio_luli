from django.contrib import admin

from .models import Category, Reference, ReferenceLink, Work


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