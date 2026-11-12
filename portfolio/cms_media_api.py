import json

from django.db import transaction
from django.db.models import Max, Q
from django.http import JsonResponse
from django.views.decorators.cache import never_cache
from django.views.decorators.csrf import csrf_protect
from django.views.decorators.http import require_GET, require_POST

from .models import Work, WorkImage, WorkVideo


def _image_url(image):
    try:
        return image.url if image else ""
    except ValueError:
        return ""


@require_GET
@never_cache
def cms_media_library(request):
    """Return a unified, searchable inventory of gallery images and YouTube videos."""
    if not request.user.is_authenticated:
        return JsonResponse({"error": "authentication_required"}, status=401)
    if not request.user.is_staff:
        return JsonResponse({"error": "staff_required"}, status=403)

    kind = request.GET.get("type", "all").strip().lower()
    if kind not in {"all", "image", "video"}:
        return JsonResponse({"error": "invalid_media_type"}, status=400)
    query = request.GET.get("q", "").strip()[:120]

    images = WorkImage.objects.select_related("work", "work__category")
    videos = WorkVideo.objects.select_related("work", "work__category")
    if query:
        images = images.filter(
            Q(work__title__icontains=query) | Q(image__icontains=query)
        )
        videos = videos.filter(
            Q(work__title__icontains=query)
            | Q(video_title__icontains=query)
            | Q(video_id__icontains=query)
        )

    entries = []
    if kind in {"all", "image"}:
        for item in images:
            entries.append({
                "id": item.pk,
                "type": "image",
                "workId": item.work_id,
                "workTitle": item.work.title,
                "categoryTitle": item.work.category.title,
                "position": item.position,
                "title": f"Foto {item.position + 1:02d}",
                "detail": item.image.name.rsplit("/", 1)[-1],
                "preview": _image_url(item.image),
                "youtubeUrl": "",
            })
    if kind in {"all", "video"}:
        for item in videos:
            entries.append({
                "id": item.pk,
                "type": "video",
                "workId": item.work_id,
                "workTitle": item.work.title,
                "categoryTitle": item.work.category.title,
                "position": item.position,
                "title": item.video_title or "Vídeo do YouTube",
                "detail": item.video_id,
                "preview": item.thumbnail_url,
                "youtubeUrl": item.youtube_url,
            })

    entries.sort(key=lambda item: (
        item["workTitle"].casefold(), item["type"], item["position"], item["id"]
    ))
    try:
        limit = min(max(int(request.GET.get("limit", "100")), 1), 500)
        offset = max(int(request.GET.get("offset", "0")), 0)
    except (TypeError, ValueError):
        return JsonResponse({"error": "invalid_pagination"}, status=400)

    works = list(
        Work.objects.select_related("category")
        .order_by("category__position", "position", "pk")
        .values("id", "title", "category__title")
    )
    return JsonResponse({
        "results": entries[offset:offset + limit],
        "works": [
            {"id": item["id"], "title": item["title"], "categoryTitle": item["category__title"]}
            for item in works
        ],
        "total": len(entries),
        "limit": limit,
        "offset": offset,
        "hasMore": offset + limit < len(entries),
    })


def _normalize_positions(queryset):
    ids = list(queryset.order_by("position", "pk").values_list("pk", flat=True))
    for position, item_id in enumerate(ids):
        queryset.model.objects.filter(pk=item_id).update(position=position)


@require_POST
@never_cache
@csrf_protect
def cms_media_move(request):
    """Move an existing gallery image or video to another work without copying media."""
    if not request.user.is_authenticated:
        return JsonResponse({"error": "authentication_required"}, status=401)
    if not request.user.is_staff:
        return JsonResponse({"error": "staff_required"}, status=403)
    if not request.user.has_perm("portfolio.change_work"):
        return JsonResponse({"error": "work_edit_permission_required"}, status=403)
    if request.content_type != "application/json" or len(request.body) > 8192:
        return JsonResponse({"error": "invalid_request"}, status=400)
    try:
        payload = json.loads(request.body.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        return JsonResponse({"error": "invalid_json"}, status=400)
    if not isinstance(payload, dict) or set(payload) != {"type", "itemId", "workId"}:
        return JsonResponse({"error": "invalid_payload"}, status=400)

    kind, item_id, destination_id = payload["type"], payload["itemId"], payload["workId"]
    if kind not in {"image", "video"} or type(item_id) is not int or type(destination_id) is not int:
        return JsonResponse({"error": "invalid_payload"}, status=400)

    model = WorkImage if kind == "image" else WorkVideo
    with transaction.atomic():
        try:
            item = model.objects.select_for_update().select_related("work").get(pk=item_id)
            source = Work.objects.select_for_update().get(pk=item.work_id)
            destination = Work.objects.select_for_update().select_related("category").get(pk=destination_id)
        except (model.DoesNotExist, Work.DoesNotExist):
            return JsonResponse({"error": "media_or_work_not_found"}, status=404)

        if source.pk == destination.pk:
            return JsonResponse({"error": "same_work"}, status=400)
        if kind == "video" and WorkVideo.objects.filter(
            work=destination, video_id=item.video_id
        ).exists():
            return JsonResponse({"error": "video_already_attached"}, status=409)

        last_position = model.objects.filter(work=destination).aggregate(value=Max("position"))["value"]
        item.work = destination
        item.position = 0 if last_position is None else last_position + 1
        item.save(update_fields=["work", "position"])
        _normalize_positions(model.objects.filter(work=source))
        _normalize_positions(model.objects.filter(work=destination))

    return JsonResponse({
        "moved": True,
        "id": item.pk,
        "type": kind,
        "workId": destination.pk,
        "workTitle": destination.title,
        "position": item.position,
    })
