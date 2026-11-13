"""Authenticated API for safe portfolio layout customization."""
import json

from django.http import JsonResponse
from django.views.decorators.cache import never_cache
from django.views.decorators.csrf import csrf_protect, ensure_csrf_cookie
from django.views.decorators.http import require_http_methods

from .layout_settings import LAYOUT_SETTING_CHOICES, normalize_layout_settings
from .models import ArtistProfile


def _staff_required(view):
    def wrapped(request, *args, **kwargs):
        if not request.user.is_authenticated:
            return JsonResponse({"error": "authentication_required"}, status=401)
        if not request.user.is_staff:
            return JsonResponse({"error": "staff_required"}, status=403)
        return view(request, *args, **kwargs)
    return wrapped


@require_http_methods(["GET", "PATCH"])
@never_cache
@ensure_csrf_cookie
@csrf_protect
@_staff_required
def cms_layout(request):
    profile = ArtistProfile.objects.order_by("pk").first()

    if request.method == "GET":
        return JsonResponse({
            "settings": normalize_layout_settings(profile.layout_settings if profile else {}),
            "permissions": {
                "canChange": bool(profile and request.user.has_perm("portfolio.change_artistprofile")),
            },
        })

    if request.content_type != "application/json" or len(request.body) > 8192:
        return JsonResponse({"error": "invalid_request"}, status=400)
    try:
        payload = json.loads(request.body.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        return JsonResponse({"error": "invalid_json"}, status=400)
    if not isinstance(payload, dict) or not payload or set(payload) - set(LAYOUT_SETTING_CHOICES):
        return JsonResponse({"error": "invalid_layout_payload"}, status=400)
    if not profile:
        return JsonResponse({"error": "profile_not_found"}, status=404)
    if not request.user.has_perm("portfolio.change_artistprofile"):
        return JsonResponse({"error": "layout_edit_permission_required"}, status=403)

    for key, value in payload.items():
        if not isinstance(value, str) or value not in LAYOUT_SETTING_CHOICES[key]:
            return JsonResponse({"error": "invalid_layout_setting", "field": key}, status=400)

    settings = normalize_layout_settings(profile.layout_settings)
    settings.update(payload)
    profile.layout_settings = settings
    profile.save(update_fields=["layout_settings"])
    return JsonResponse({
        "settings": normalize_layout_settings(profile.layout_settings),
        "permissions": {"canChange": True},
    })
