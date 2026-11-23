from django.http import JsonResponse
from django.views.decorators.cache import cache_control
from django.views.decorators.http import require_GET

from .models import StudioTemplate


@require_GET
@cache_control(public=True, max_age=60, stale_while_revalidate=300)
def published_templates(request):
    templates = StudioTemplate.objects.filter(is_published=True).order_by("position", "id")
    return JsonResponse({
        "results": [
            {
                "id": item.pk,
                "slug": item.slug,
                "title": item.title,
                "kind": item.kind,
                "description": item.description,
                "presentationMode": item.presentation_mode,
                "previewShape": item.preview_shape,
                "tags": item.tags if isinstance(item.tags, list) else [],
                "layoutConfig": item.layout_config if isinstance(item.layout_config, dict) else {},
                "position": item.position,
            }
            for item in templates
        ]
    })
