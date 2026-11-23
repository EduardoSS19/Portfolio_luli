import json

from django import forms
from django.core.exceptions import ValidationError
from django.http import JsonResponse
from django.views.decorators.cache import never_cache
from django.views.decorators.csrf import csrf_protect, ensure_csrf_cookie
from django.views.decorators.http import require_http_methods, require_GET

from .models import StudioTemplate


class StudioTemplateForm(forms.ModelForm):
    class Meta:
        model = StudioTemplate
        fields = ("slug", "title", "kind", "description", "presentation_mode", "preview_shape", "tags", "layout_config", "position", "is_published")


def _staff_required(request):
    if not request.user.is_authenticated:
        return JsonResponse({"error": "authentication_required"}, status=401)
    if not request.user.is_staff:
        return JsonResponse({"error": "staff_required"}, status=403)
    return None


def _serialize(item):
    return {
        "id": item.pk, "slug": item.slug, "title": item.title, "kind": item.kind,
        "description": item.description, "presentationMode": item.presentation_mode,
        "previewShape": item.preview_shape, "tags": item.tags if isinstance(item.tags, list) else [],
        "layoutConfig": item.layout_config if isinstance(item.layout_config, dict) else {},
        "position": item.position, "isPublished": item.is_published,
    }


@require_GET
@never_cache
def published_templates(request):
    templates = StudioTemplate.objects.filter(is_published=True).order_by("position", "id")
    return JsonResponse({"results": [_serialize(item) for item in templates]})


@require_http_methods(["GET", "POST"])
@never_cache
@ensure_csrf_cookie
@csrf_protect
def manage_templates(request):
    denied = _staff_required(request)
    if denied:
        return denied

    if request.method == "GET":
        if not request.user.has_perm("studio_catalog.view_studiotemplate") and not request.user.has_perm("studio_catalog.change_studiotemplate"):
            return JsonResponse({"error": "permission_required"}, status=403)
        return JsonResponse({
            "results": [_serialize(item) for item in StudioTemplate.objects.order_by("position", "id")],
            "permissions": {
                "canAdd": request.user.has_perm("studio_catalog.add_studiotemplate"),
                "canChange": request.user.has_perm("studio_catalog.change_studiotemplate"),
                "canDelete": request.user.has_perm("studio_catalog.delete_studiotemplate"),
            },
        })

    if not request.user.has_perm("studio_catalog.add_studiotemplate"):
        return JsonResponse({"error": "permission_required"}, status=403)
    try:
        payload = json.loads(request.body.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        return JsonResponse({"error": "invalid_json"}, status=400)
    if not isinstance(payload, dict):
        return JsonResponse({"error": "invalid_payload"}, status=400)
    form = StudioTemplateForm(payload)
    if not form.is_valid():
        return JsonResponse({"error": "validation_error", "fields": form.errors.get_json_data()}, status=400)
    item = form.save()
    return JsonResponse({"result": _serialize(item)}, status=201)


@require_http_methods(["PATCH", "DELETE"])
@never_cache
@ensure_csrf_cookie
@csrf_protect
def manage_template_detail(request, template_id):
    denied = _staff_required(request)
    if denied:
        return denied
    try:
        item = StudioTemplate.objects.get(pk=template_id)
    except StudioTemplate.DoesNotExist:
        return JsonResponse({"error": "template_not_found"}, status=404)

    if request.method == "DELETE":
        if not request.user.has_perm("studio_catalog.delete_studiotemplate"):
            return JsonResponse({"error": "permission_required"}, status=403)
        item.delete()
        return JsonResponse({"deleted": True, "id": template_id})

    if not request.user.has_perm("studio_catalog.change_studiotemplate"):
        return JsonResponse({"error": "permission_required"}, status=403)
    try:
        payload = json.loads(request.body.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        return JsonResponse({"error": "invalid_json"}, status=400)
    if not isinstance(payload, dict):
        return JsonResponse({"error": "invalid_payload"}, status=400)
    form = StudioTemplateForm(payload, instance=item)
    if not form.is_valid():
        return JsonResponse({"error": "validation_error", "fields": form.errors.get_json_data()}, status=400)
    item = form.save()
    return JsonResponse({"result": _serialize(item)})
