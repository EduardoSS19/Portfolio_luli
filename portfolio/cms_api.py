"""Authenticated CMS read endpoints and a narrowly scoped work metadata update API."""
import json
from functools import wraps

from django import forms
from django.db import transaction
from django.core.serializers.json import DjangoJSONEncoder
from django.db.models import Count, Q
from django.forms.models import model_to_dict
from django.http import JsonResponse
from django.views.decorators.cache import never_cache
from django.views.decorators.csrf import csrf_protect, ensure_csrf_cookie
from django.views.decorators.http import require_GET, require_http_methods

from .models import Category, Reference, Work, WorkVideo


def _staff_required(view):
    """Return JSON authorization errors instead of redirecting API clients."""
    @wraps(view)
    def wrapped(request, *args, **kwargs):
        if not request.user.is_authenticated:
            return JsonResponse({"error": "authentication_required"}, status=401)
        if not request.user.is_staff:
            return JsonResponse({"error": "staff_required"}, status=403)
        return view(request, *args, **kwargs)

    return wrapped


@require_GET
@never_cache
@_staff_required
def cms_overview(request):
    """Small editorial summary for the CMS home screen."""
    return JsonResponse({
        "works": {
            "total": Work.objects.count(),
            "published": Work.objects.filter(is_active=True).count(),
            "drafts": Work.objects.filter(is_active=False).count(),
        },
        "categories": Category.objects.count(),
        "categoryOptions": list(Category.objects.order_by("position", "pk").values("id", "key", "title")),
        "references": Reference.objects.count(),
        "videos": WorkVideo.objects.count(),
    })


@require_GET
@never_cache
@_staff_required
def cms_works(request):
    """Paginated, searchable library data; no unpublished data reaches public APIs."""
    search = request.GET.get("q", "").strip()[:120]
    category_key = request.GET.get("category", "").strip()[:50]
    status = request.GET.get("status", "all").strip().lower()

    if status not in {"all", "published", "draft"}:
        return JsonResponse({"error": "invalid_status"}, status=400)

    try:
        limit = int(request.GET.get("limit", "24"))
        offset = int(request.GET.get("offset", "0"))
    except (TypeError, ValueError):
        return JsonResponse({"error": "invalid_pagination"}, status=400)

    if limit < 1 or offset < 0:
        return JsonResponse({"error": "invalid_pagination"}, status=400)

    limit = min(limit, 50)
    queryset = Work.objects.select_related("category").annotate(
        gallery_count=Count("gallery_images", distinct=True),
        video_count=Count("youtube_videos", distinct=True),
    )

    if status == "published":
        queryset = queryset.filter(is_active=True)
    elif status == "draft":
        queryset = queryset.filter(is_active=False)

    if category_key:
        queryset = queryset.filter(category__key=category_key)

    if search:
        queryset = queryset.filter(
            Q(title__icontains=search)
            | Q(description__icontains=search)
            | Q(category__title__icontains=search)
        )

    queryset = queryset.order_by("category__position", "position", "pk")
    total = queryset.count()
    works = list(queryset[offset:offset + limit])

    results = []
    for work in works:
        image = ""
        if work.image:
            try:
                image = work.image.url
            except ValueError:
                image = ""
        if not image:
            image = work.image_url or ""

        results.append({
            "id": work.pk,
            "title": work.title,
            "category": {
                "key": work.category.key,
                "title": work.category.title,
            },
            "image": image,
            "published": work.is_active,
            "position": work.position,
            "media": {
                "images": 1 if image else 0,
                "gallery": work.gallery_count,
                "videos": work.video_count,
            },
            "updatedAt": None,
        })

    return JsonResponse({
        "results": results,
        "pagination": {
            "total": total,
            "limit": limit,
            "offset": offset,
            "hasMore": offset + len(results) < total,
        },
        "filters": {
            "q": search,
            "category": category_key,
            "status": status,
        },
    })


class CmsWorkEditForm(forms.ModelForm):
    """Allowlisted editorial fields; publication and media are separate workflows."""

    class Meta:
        model = Work
        fields = (
            "category", "title", "description", "detail", "technique", "material",
            "support", "year", "height", "width", "depth", "dimension_unit",
            "price", "currency", "availability", "series", "edition", "print_run",
            "signed", "creation_location", "condition", "exhibitions", "position",
        )


@require_http_methods(["GET", "PATCH"])
@never_cache
@ensure_csrf_cookie
@csrf_protect
def cms_work_update(request, work_id):
    """Read or update editorial metadata without touching publication or media."""
    if not request.user.is_authenticated:
        return JsonResponse({"error": "authentication_required"}, status=401)
    if not request.user.is_staff:
        return JsonResponse({"error": "staff_required"}, status=403)

    try:
        work = Work.objects.select_related("category").get(pk=work_id)
    except Work.DoesNotExist:
        return JsonResponse({"error": "work_not_found"}, status=404)

    if request.method == "GET":
        return JsonResponse({
            "id": work.pk,
            "category": work.category_id,
            "title": work.title,
            "description": work.description,
            "detail": work.detail,
            "technique": work.technique,
            "material": work.material,
            "support": work.support,
            "year": work.year,
            "height": work.height,
            "width": work.width,
            "depth": work.depth,
            "dimension_unit": work.dimension_unit,
            "price": work.price,
            "currency": work.currency,
            "availability": work.availability,
            "series": work.series,
            "edition": work.edition,
            "print_run": work.print_run,
            "signed": work.signed,
            "creation_location": work.creation_location,
            "condition": work.condition,
            "exhibitions": work.exhibitions,
            "position": work.position,
            "published": work.is_active,
        }, encoder=DjangoJSONEncoder)

    if not request.user.has_perm("portfolio.change_work"):
        return JsonResponse({"error": "work_edit_permission_required"}, status=403)
    if request.content_type != "application/json":
        return JsonResponse({"error": "application_json_required"}, status=415)
    if len(request.body) > 65536:
        return JsonResponse({"error": "payload_too_large"}, status=413)

    try:
        payload = json.loads(request.body.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        return JsonResponse({"error": "invalid_json"}, status=400)

    if not isinstance(payload, dict) or not payload:
        return JsonResponse({"error": "invalid_payload"}, status=400)

    allowed_fields = set(CmsWorkEditForm.Meta.fields)
    unknown_fields = sorted(set(payload) - allowed_fields)
    if unknown_fields:
        return JsonResponse({
            "error": "unknown_fields",
            "fields": unknown_fields,
        }, status=400)

    with transaction.atomic():
        try:
            work = Work.objects.select_for_update().select_related("category").get(pk=work_id)
        except Work.DoesNotExist:
            return JsonResponse({"error": "work_not_found"}, status=404)

        form_data = model_to_dict(work, fields=CmsWorkEditForm.Meta.fields)
        form_data.update(payload)
        form = CmsWorkEditForm(data=form_data, instance=work)
        if not form.is_valid():
            return JsonResponse({
                "error": "validation_error",
                "fields": form.errors.get_json_data(),
            }, status=400)

        work = form.save()

    return JsonResponse({
        "id": work.pk,
        "title": work.title,
        "category": {
            "id": work.category_id,
            "key": work.category.key,
            "title": work.category.title,
        },
        "description": work.description,
        "detail": work.detail,
        "technique": work.technique,
        "material": work.material,
        "support": work.support,
        "year": work.year,
        "height": work.height,
        "width": work.width,
        "depth": work.depth,
        "dimension_unit": work.dimension_unit,
        "price": work.price,
        "currency": work.currency,
        "availability": work.availability,
        "series": work.series,
        "edition": work.edition,
        "print_run": work.print_run,
        "signed": work.signed,
        "creation_location": work.creation_location,
        "condition": work.condition,
        "exhibitions": work.exhibitions,
        "position": work.position,
        "published": work.is_active,
    }, encoder=DjangoJSONEncoder)
