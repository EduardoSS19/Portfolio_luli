from django.contrib import admin

from .models import StudioTemplate


@admin.register(StudioTemplate)
class StudioTemplateAdmin(admin.ModelAdmin):
    list_display = ("title", "kind", "presentation_mode", "position", "is_published", "updated_at")
    list_display_links = ("title",)
    list_filter = ("is_published", "presentation_mode")
    list_editable = ("position", "is_published")
    search_fields = ("title", "slug", "description", "kind")
    prepopulated_fields = {"slug": ("title",)}
    ordering = ("position", "id")
    fieldsets = (
        ("Identidade", {"fields": ("title", "slug", "kind", "description")}),
        ("Experiência", {"fields": ("presentation_mode", "preview_shape", "tags", "layout_config")}),
        ("Publicação", {"fields": ("position", "is_published")}),
    )
