"""Read-only endpoints for the first React CMS library screen.

All endpoints require an authenticated staff user. Mutations are intentionally
not exposed here; they will be added only with dedicated validation and tests.
"""
from django.contrib.auth.decorators import user_passes_test
from django.core.paginator import Paginator
from django.db.models import Count, Q
from django.http import JsonResponse
from django.utils.decorators import method_decorator
from django.views.decorators.cache import never_cache
from django.views.decorators.http import require_GET

from .models import Category, Reference, Work, WorkVideo


def _staff_required(view):
    """Return JSON authorization errors instead of redirecting API clients."""
    def check(user):
        return user.is_authenticated and user.is_staff

    protected = user_passes_test(check, login_url=None)(view)

    def wrapped(request, *args, **kwargs):
        if not request.user.is_authenticated:
            return JsonResponse({"error": "authentication_required"}, status=401)
        if not request.user.is_staff:
            return JsonResponse({"error": "staff_required"}, status=403)
        return protected(request, *args, **kwargs)

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
    page = Paginator(queryset, limit).get_page((offset // limit) + 1)
    works = list(page.object_list)

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
