"""Authenticated CMS read endpoints and a narrowly scoped work metadata update API."""
import json
import logging
from functools import wraps

from PIL import Image, UnidentifiedImageError
from django.core import signing
from django.utils.text import slugify
from django.core.files.storage import default_storage

from django import forms
from django.db import transaction
from django.core.serializers.json import DjangoJSONEncoder
from django.db.models import Count, Prefetch, Q
from django.forms.models import model_to_dict
from django.http import JsonResponse
from django.views.decorators.cache import never_cache
from django.views.decorators.csrf import csrf_protect, ensure_csrf_cookie
from django.views.decorators.http import require_GET, require_http_methods, require_POST
from django.db.models import Max

from .models import ArtistProfile, Category, Reference, Work, WorkImage, WorkVideo
from .youtube import YouTubeMetadataError, fetch_youtube_video_metadata


logger = logging.getLogger(__name__)
MAX_COVER_UPLOAD_SIZE = 15 * 1024 * 1024
ALLOWED_COVER_FORMATS = {"JPEG": "jpg", "PNG": "png", "WEBP": "webp"}
MAX_COVER_PIXELS = 40_000_000


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
@ensure_csrf_cookie
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
        "permissions": {
            "canCreateWork": request.user.has_perm("portfolio.add_work"),
            "canEditWork": request.user.has_perm("portfolio.change_work"),
            "canDeleteWork": request.user.has_perm("portfolio.delete_work"),
        },
    })


class CmsArtistProfileForm(forms.ModelForm):
    class Meta:
        model = ArtistProfile
        fields = (
            "name", "tagline", "photo_url", "bio",
            "instagram_url", "contact_email", "contact_form_url",
        )


@require_http_methods(["GET", "PATCH"])
@never_cache
@ensure_csrf_cookie
@csrf_protect
@_staff_required
def cms_profile(request):
    """Read and update the artist profile without exposing it publicly to editors."""
    profile = ArtistProfile.objects.order_by("pk").first()
    if request.method == "GET":
        if not profile:
            return JsonResponse({
                "profile": None,
                "permissions": {
                    "canAdd": request.user.has_perm("portfolio.add_artistprofile"),
                    "canChange": request.user.has_perm("portfolio.change_artistprofile"),
                },
            })
        return JsonResponse({
            "profile": {
                "id": profile.pk,
                "name": profile.name,
                "tagline": profile.tagline,
                "photo": _cms_image_url(profile.photo),
                "photo_url": profile.photo_url,
                "bio": profile.bio,
                "instagram_url": profile.instagram_url,
                "contact_email": profile.contact_email,
                "contact_form_url": profile.contact_form_url,
            },
            "permissions": {
                "canAdd": request.user.has_perm("portfolio.add_artistprofile"),
                "canChange": request.user.has_perm("portfolio.change_artistprofile"),
            },
        })

    if profile and not request.user.has_perm("portfolio.change_artistprofile"):
        return JsonResponse({"error": "profile_edit_permission_required"}, status=403)
    if not profile and not request.user.has_perm("portfolio.add_artistprofile"):
        return JsonResponse({"error": "profile_add_permission_required"}, status=403)
    if request.content_type != "application/json" or len(request.body) > 16384:
        return JsonResponse({"error": "invalid_request"}, status=400)
    try:
        payload = json.loads(request.body.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        return JsonResponse({"error": "invalid_json"}, status=400)
    if not isinstance(payload, dict):
        return JsonResponse({"error": "invalid_profile_payload"}, status=400)

    form = CmsArtistProfileForm(payload, instance=profile)
    if not form.is_valid():
        return JsonResponse({
            "error": "invalid_profile",
            "fields": {
                field: [{"message": str(error)} for error in errors]
                for field, errors in form.errors.items()
            },
        }, status=400)
    profile = form.save()
    return JsonResponse({
        "profile": {
            "id": profile.pk,
            "name": profile.name,
            "tagline": profile.tagline,
            "photo": _cms_image_url(profile.photo),
            "photo_url": profile.photo_url,
            "bio": profile.bio,
            "instagram_url": profile.instagram_url,
            "contact_email": profile.contact_email,
            "contact_form_url": profile.contact_form_url,
        },
        "permissions": {
            "canAdd": request.user.has_perm("portfolio.add_artistprofile"),
            "canChange": request.user.has_perm("portfolio.change_artistprofile"),
        },
    })


@require_POST
@never_cache
@csrf_protect
def cms_profile_photo_upload(request):
    if not request.user.is_authenticated:
        return JsonResponse({"error": "authentication_required"}, status=401)
    if not request.user.is_staff:
        return JsonResponse({"error": "staff_required"}, status=403)
    if not request.user.has_perm("portfolio.change_artistprofile"):
        return JsonResponse({"error": "profile_edit_permission_required"}, status=403)
    profile = ArtistProfile.objects.order_by("pk").first()
    if not profile:
        return JsonResponse({"error": "profile_not_found"}, status=404)
    if not request.content_type.startswith("multipart/form-data"):
        return JsonResponse({"error": "multipart_form_data_required"}, status=415)
    if set(request.FILES.keys()) != {"image"} or len(request.FILES.getlist("image")) != 1:
        return JsonResponse({"error": "exactly_one_image_required"}, status=400)

    uploaded = request.FILES["image"]
    if uploaded.size <= 0:
        return JsonResponse({"error": "empty_image"}, status=400)
    if uploaded.size > MAX_COVER_UPLOAD_SIZE:
        return JsonResponse({"error": "image_too_large", "maxBytes": MAX_COVER_UPLOAD_SIZE}, status=413)
    try:
        uploaded.seek(0)
        with Image.open(uploaded) as image:
            image_format = image.format
            width, height = image.size
            if image_format not in ALLOWED_COVER_FORMATS:
                return JsonResponse({"error": "unsupported_image_format"}, status=400)
            if width <= 0 or height <= 0 or width * height > MAX_COVER_PIXELS:
                return JsonResponse({"error": "invalid_image_dimensions"}, status=400)
            image.verify()
        uploaded.seek(0)
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError, Image.DecompressionBombWarning):
        return JsonResponse({"error": "invalid_image_file"}, status=400)

    old_name = profile.photo.name if profile.photo else ""
    extension = ALLOWED_COVER_FORMATS[image_format]
    upload_name = profile.photo.field.generate_filename(profile, f"profile.{extension}")
    stored_name = ""
    try:
        stored_name = default_storage.save(upload_name, uploaded)
        profile.photo.name = stored_name
        profile.save(update_fields=["photo"])
    except Exception:
        if stored_name:
            try:
                default_storage.delete(stored_name)
            except Exception:
                logger.exception("Could not clean up failed CMS profile photo %s", stored_name)
        logger.exception("CMS profile photo upload failed")
        return JsonResponse({"error": "image_storage_failed"}, status=503)

    if old_name and old_name != stored_name:
        try:
            default_storage.delete(old_name)
        except Exception:
            logger.exception("Could not delete replaced CMS profile photo %s", old_name)
    return JsonResponse({"photo": _cms_image_url(profile.photo)})


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
    ).prefetch_related(
        Prefetch(
            "gallery_images",
            queryset=WorkImage.objects.only("id", "work_id", "image", "position").order_by("position", "pk"),
            to_attr="cms_gallery_images",
        ),
        Prefetch(
            "youtube_videos",
            queryset=WorkVideo.objects.only("id", "work_id", "thumbnail_url", "position").order_by("position", "pk"),
            to_attr="cms_videos",
        ),
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

        # Prefer the first carousel image, then the first video thumbnail.
        if not image and work.cms_gallery_images:
            image = _cms_image_url(work.cms_gallery_images[0].image)
        if not image and work.cms_videos:
            image = work.cms_videos[0].thumbnail_url or ""

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
            "signed", "creation_location", "condition", "exhibitions", "position", "image_url", "is_share_image",
        )

    def clean(self):
        cleaned = super().clean()
        if cleaned.get("is_share_image") and not (self.instance.image or cleaned.get("image_url")):
            self.add_error("is_share_image", "Escolha uma imagem de capa antes de usar esta obra no compartilhamento.")
        return cleaned


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
        cover_url = ""
        if work.image:
            try:
                cover_url = work.image.url
            except ValueError:
                cover_url = ""
        if not cover_url:
            cover_url = work.image_url or ""
        return JsonResponse({
            "id": work.pk,
            "image": cover_url,
            "image_url": work.image_url,
            "is_share_image": work.is_share_image,
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
        if work.is_share_image:
            Work.objects.exclude(pk=work.pk).filter(is_share_image=True).update(is_share_image=False)

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
        "image_url": work.image_url,
        "is_share_image": work.is_share_image,
    }, encoder=DjangoJSONEncoder)


@require_POST
@never_cache
@csrf_protect
def cms_work_create(request):
    """Create a new unpublished work from allowlisted editorial metadata."""
    if not request.user.is_authenticated:
        return JsonResponse({"error": "authentication_required"}, status=401)
    if not request.user.is_staff:
        return JsonResponse({"error": "staff_required"}, status=403)
    if not request.user.has_perm("portfolio.add_work"):
        return JsonResponse({"error": "work_create_permission_required"}, status=403)
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

    form = CmsWorkEditForm(data=payload)
    if not form.is_valid():
        return JsonResponse({
            "error": "validation_error",
            "fields": form.errors.get_json_data(),
        }, status=400)

    with transaction.atomic():
        work = form.save(commit=False)
        work.is_active = False
        work.save()
        if work.is_share_image:
            Work.objects.exclude(pk=work.pk).filter(is_share_image=True).update(is_share_image=False)

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
        "image_url": work.image_url,
        "is_share_image": work.is_share_image,
    }, status=201, encoder=DjangoJSONEncoder)


@require_POST
@never_cache
@csrf_protect
def cms_work_cover_upload(request, work_id):
    """Replace one work cover after validating its actual image content."""
    if not request.user.is_authenticated:
        return JsonResponse({"error": "authentication_required"}, status=401)
    if not request.user.is_staff:
        return JsonResponse({"error": "staff_required"}, status=403)
    if not request.user.has_perm("portfolio.change_work"):
        return JsonResponse({"error": "work_edit_permission_required"}, status=403)

    try:
        work = Work.objects.get(pk=work_id)
    except Work.DoesNotExist:
        return JsonResponse({"error": "work_not_found"}, status=404)

    if not request.content_type.startswith("multipart/form-data"):
        return JsonResponse({"error": "multipart_form_data_required"}, status=415)

    if set(request.FILES.keys()) != {"image"} or len(request.FILES.getlist("image")) != 1:
        return JsonResponse({"error": "exactly_one_image_required"}, status=400)

    uploaded = request.FILES["image"]
    if uploaded.size <= 0:
        return JsonResponse({"error": "empty_image"}, status=400)
    if uploaded.size > MAX_COVER_UPLOAD_SIZE:
        return JsonResponse({"error": "image_too_large", "maxBytes": MAX_COVER_UPLOAD_SIZE}, status=413)

    try:
        uploaded.seek(0)
        with Image.open(uploaded) as image:
            image_format = image.format
            width, height = image.size
            if image_format not in ALLOWED_COVER_FORMATS:
                return JsonResponse({"error": "unsupported_image_format"}, status=400)
            if width <= 0 or height <= 0 or width * height > MAX_COVER_PIXELS:
                return JsonResponse({"error": "invalid_image_dimensions"}, status=400)
            image.verify()
        uploaded.seek(0)
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError, Image.DecompressionBombWarning):
        return JsonResponse({"error": "invalid_image_file"}, status=400)

    old_name = work.image.name if work.image else ""
    extension = ALLOWED_COVER_FORMATS[image_format]
    upload_name = work.image.field.generate_filename(work, f"cover.{extension}")
    stored_name = ""
    try:
        stored_name = default_storage.save(upload_name, uploaded)
        work.image.name = stored_name
        work.image_url = ""
        work.save(update_fields=["image", "image_url"])
    except Exception:
        if stored_name:
            try:
                default_storage.delete(stored_name)
            except Exception:
                logger.exception("Could not clean up failed CMS cover upload %s", stored_name)
        logger.exception("CMS cover upload failed for work %s", work_id)
        return JsonResponse({"error": "image_storage_failed"}, status=503)

    if old_name and old_name != stored_name:
        try:
            default_storage.delete(old_name)
        except Exception:
            # The new cover is already committed; keep the successful response and log cleanup.
            logger.exception("Could not delete replaced CMS cover %s", old_name)

    try:
        image_url = work.image.url
    except ValueError:
        image_url = ""

    return JsonResponse({
        "id": work.pk,
        "image": image_url,
        "filename": stored_name.rsplit("/", 1)[-1],
    }, status=200)



def _cms_image_url(image_field):
    try:
        return image_field.url if image_field else ""
    except ValueError:
        return ""


def _validate_cms_gallery_image(uploaded):
    if uploaded.size <= 0:
        return "empty_image"
    if uploaded.size > MAX_COVER_UPLOAD_SIZE:
        return "image_too_large"
    try:
        uploaded.seek(0)
        with Image.open(uploaded) as image:
            image_format = image.format
            width, height = image.size
            if image_format not in ALLOWED_COVER_FORMATS:
                return "unsupported_image_format"
            if width <= 0 or height <= 0 or width * height > MAX_COVER_PIXELS:
                return "invalid_image_dimensions"
            image.verify()
        uploaded.seek(0)
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError, Image.DecompressionBombWarning):
        return "invalid_image_file"
    return None


@require_http_methods(["GET", "POST", "PATCH"])
@never_cache
@ensure_csrf_cookie
@csrf_protect
def cms_work_gallery(request, work_id):
    """List, upload, and reorder additional images for one work."""
    if not request.user.is_authenticated:
        return JsonResponse({"error": "authentication_required"}, status=401)
    if not request.user.is_staff:
        return JsonResponse({"error": "staff_required"}, status=403)
    if request.method != "GET" and not request.user.has_perm("portfolio.change_work"):
        return JsonResponse({"error": "work_edit_permission_required"}, status=403)

    try:
        work = Work.objects.get(pk=work_id)
    except Work.DoesNotExist:
        return JsonResponse({"error": "work_not_found"}, status=404)

    if request.method == "GET":
        images = [{
            "id": item.pk,
            "url": _cms_image_url(item.image),
            "position": item.position,
        } for item in work.gallery_images.all().order_by("position", "pk")]
        return JsonResponse({"results": images, "total": len(images)})

    if request.method == "POST":
        if not request.content_type.startswith("multipart/form-data"):
            return JsonResponse({"error": "multipart_form_data_required"}, status=415)
        if set(request.FILES.keys()) != {"image"} or len(request.FILES.getlist("image")) != 1:
            return JsonResponse({"error": "exactly_one_image_required"}, status=400)
        uploaded = request.FILES["image"]
        validation_error = _validate_cms_gallery_image(uploaded)
        if validation_error:
            status = 413 if validation_error == "image_too_large" else 400
            return JsonResponse({"error": validation_error, "maxBytes": MAX_COVER_UPLOAD_SIZE} if status == 413 else {"error": validation_error}, status=status)

        extension = ALLOWED_COVER_FORMATS[Image.open(uploaded).format]
        uploaded.seek(0)
        last_position = work.gallery_images.aggregate(value=Max("position"))["value"]
        position = 0 if last_position is None else last_position + 1
        filename = work.image.field.generate_filename(work, f"gallery-{position + 1}.{extension}")
        stored_name = ""
        try:
            stored_name = default_storage.save(filename, uploaded)
            gallery_image = WorkImage.objects.create(work=work, image=stored_name, position=position)
        except Exception:
            if stored_name:
                try:
                    default_storage.delete(stored_name)
                except Exception:
                    logger.exception("Could not clean up failed CMS gallery upload %s", stored_name)
            logger.exception("CMS gallery upload failed for work %s", work_id)
            return JsonResponse({"error": "image_storage_failed"}, status=503)

        return JsonResponse({
            "id": gallery_image.pk,
            "url": _cms_image_url(gallery_image.image),
            "position": gallery_image.position,
        }, status=201)

    if request.content_type != "application/json":
        return JsonResponse({"error": "application_json_required"}, status=415)
    if len(request.body) > 16384:
        return JsonResponse({"error": "payload_too_large"}, status=413)
    try:
        payload = json.loads(request.body.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        return JsonResponse({"error": "invalid_json"}, status=400)
    image_ids = payload.get("imageIds") if isinstance(payload, dict) else None
    if not isinstance(image_ids, list) or any(type(item) is not int for item in image_ids):
        return JsonResponse({"error": "invalid_image_order"}, status=400)
    if len(image_ids) != len(set(image_ids)):
        return JsonResponse({"error": "duplicate_image_ids"}, status=400)

    with transaction.atomic():
        locked_work = Work.objects.select_for_update().get(pk=work_id)
        existing_ids = list(WorkImage.objects.filter(work=locked_work).values_list("pk", flat=True))
        if set(image_ids) != set(existing_ids) or len(image_ids) != len(existing_ids):
            return JsonResponse({"error": "image_order_mismatch"}, status=400)
        for position, image_id in enumerate(image_ids):
            WorkImage.objects.filter(pk=image_id, work=locked_work).update(position=position)

    images = [{
        "id": item.pk,
        "url": _cms_image_url(item.image),
        "position": item.position,
    } for item in work.gallery_images.all().order_by("position", "pk")]
    return JsonResponse({"results": images, "total": len(images)})


@require_POST
@never_cache
@csrf_protect
def cms_work_gallery_item(request, work_id, image_id):
    """Replace one existing gallery image without changing its order."""
    if not request.user.is_authenticated:
        return JsonResponse({"error": "authentication_required"}, status=401)
    if not request.user.is_staff:
        return JsonResponse({"error": "staff_required"}, status=403)
    if not request.user.has_perm("portfolio.change_work"):
        return JsonResponse({"error": "work_edit_permission_required"}, status=403)
    try:
        item = WorkImage.objects.select_related("work").get(pk=image_id, work_id=work_id)
    except WorkImage.DoesNotExist:
        return JsonResponse({"error": "gallery_image_not_found"}, status=404)
    if not request.content_type.startswith("multipart/form-data"):
        return JsonResponse({"error": "multipart_form_data_required"}, status=415)
    if set(request.FILES.keys()) != {"image"} or len(request.FILES.getlist("image")) != 1:
        return JsonResponse({"error": "exactly_one_image_required"}, status=400)
    uploaded = request.FILES["image"]
    validation_error = _validate_cms_gallery_image(uploaded)
    if validation_error:
        return JsonResponse({"error": validation_error}, status=413 if validation_error == "image_too_large" else 400)
    old_name = item.image.name
    extension = ALLOWED_COVER_FORMATS[Image.open(uploaded).format]
    uploaded.seek(0)
    filename = item.image.field.generate_filename(item, f"gallery-{item.position + 1}.{extension}")
    stored_name = ""
    try:
        stored_name = default_storage.save(filename, uploaded)
        item.image.name = stored_name
        item.save(update_fields=["image"])
    except Exception:
        if stored_name:
            try:
                default_storage.delete(stored_name)
            except Exception:
                logger.exception("Could not clean up failed gallery replacement %s", stored_name)
        logger.exception("CMS gallery replacement failed for work %s", work_id)
        return JsonResponse({"error": "image_storage_failed"}, status=503)
    if old_name and old_name != stored_name:
        try:
            default_storage.delete(old_name)
        except Exception:
            logger.exception("Could not delete replaced gallery image %s", old_name)
    return JsonResponse({"id": item.pk, "url": _cms_image_url(item.image), "position": item.position})


@require_POST
@never_cache
@csrf_protect
def cms_work_gallery_delete(request, work_id, image_id):
    """Delete only an additional image belonging to the requested work."""
    if not request.user.is_authenticated:
        return JsonResponse({"error": "authentication_required"}, status=401)
    if not request.user.is_staff:
        return JsonResponse({"error": "staff_required"}, status=403)
    if not request.user.has_perm("portfolio.change_work"):
        return JsonResponse({"error": "work_edit_permission_required"}, status=403)

    try:
        image = WorkImage.objects.get(pk=image_id, work_id=work_id)
    except WorkImage.DoesNotExist:
        return JsonResponse({"error": "gallery_image_not_found"}, status=404)

    stored_name = image.image.name
    image.delete()
    if stored_name:
        try:
            default_storage.delete(stored_name)
        except Exception:
            logger.exception("Could not delete CMS gallery image file %s", stored_name)
    return JsonResponse({"deleted": image_id})



def _cms_video_payload(video):
    return {
        "id": video.pk,
        "youtubeUrl": video.youtube_url,
        "videoId": video.video_id,
        "title": video.video_title,
        "thumbnail": video.thumbnail_url,
        "position": video.position,
    }


@require_http_methods(["GET", "POST", "PATCH"])
@never_cache
@ensure_csrf_cookie
@csrf_protect
def cms_work_videos(request, work_id):
    """List, add and reorder YouTube videos attached to a work."""
    if not request.user.is_authenticated:
        return JsonResponse({"error": "authentication_required"}, status=401)
    if not request.user.is_staff:
        return JsonResponse({"error": "staff_required"}, status=403)
    if request.method != "GET" and not request.user.has_perm("portfolio.change_work"):
        return JsonResponse({"error": "work_edit_permission_required"}, status=403)

    try:
        work = Work.objects.get(pk=work_id)
    except Work.DoesNotExist:
        return JsonResponse({"error": "work_not_found"}, status=404)

    if request.method == "GET":
        videos = work.youtube_videos.all().order_by("position", "pk")
        return JsonResponse({"results": [_cms_video_payload(item) for item in videos], "total": videos.count()})

    if request.method == "POST":
        if request.content_type != "application/json":
            return JsonResponse({"error": "application_json_required"}, status=415)
        if len(request.body) > 8192:
            return JsonResponse({"error": "payload_too_large"}, status=413)
        try:
            payload = json.loads(request.body.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            return JsonResponse({"error": "invalid_json"}, status=400)
        if not isinstance(payload, dict) or set(payload) != {"youtubeUrl"}:
            return JsonResponse({"error": "invalid_payload"}, status=400)
        youtube_url = payload.get("youtubeUrl")
        if not isinstance(youtube_url, str) or not youtube_url.strip() or len(youtube_url) > 500:
            return JsonResponse({"error": "invalid_youtube_url"}, status=400)
        try:
            metadata = fetch_youtube_video_metadata(youtube_url.strip())
        except YouTubeMetadataError as error:
            return JsonResponse({"error": "youtube_metadata_error", "message": str(error)}, status=400)

        with transaction.atomic():
            locked_work = Work.objects.select_for_update().get(pk=work_id)
            if WorkVideo.objects.filter(work=locked_work, video_id=metadata["video_id"]).exists():
                return JsonResponse({"error": "video_already_attached"}, status=409)
            last_position = locked_work.youtube_videos.aggregate(value=Max("position"))["value"]
            video = WorkVideo.objects.create(
                work=locked_work,
                youtube_url=youtube_url.strip(),
                video_id=metadata["video_id"],
                video_title=metadata["title"][:255],
                thumbnail_url=metadata["thumbnail_url"],
                position=0 if last_position is None else last_position + 1,
            )
        return JsonResponse(_cms_video_payload(video), status=201)

    if request.content_type != "application/json":
        return JsonResponse({"error": "application_json_required"}, status=415)
    if len(request.body) > 16384:
        return JsonResponse({"error": "payload_too_large"}, status=413)
    try:
        payload = json.loads(request.body.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        return JsonResponse({"error": "invalid_json"}, status=400)
    video_ids = payload.get("videoIds") if isinstance(payload, dict) else None
    if not isinstance(video_ids, list) or any(type(item) is not int for item in video_ids):
        return JsonResponse({"error": "invalid_video_order"}, status=400)
    if len(video_ids) != len(set(video_ids)):
        return JsonResponse({"error": "duplicate_video_ids"}, status=400)

    with transaction.atomic():
        locked_work = Work.objects.select_for_update().get(pk=work_id)
        existing_ids = list(WorkVideo.objects.filter(work=locked_work).values_list("pk", flat=True))
        if set(video_ids) != set(existing_ids) or len(video_ids) != len(existing_ids):
            return JsonResponse({"error": "video_order_mismatch"}, status=400)
        for position, video_id in enumerate(video_ids):
            WorkVideo.objects.filter(pk=video_id, work=locked_work).update(position=position)

    videos = work.youtube_videos.all().order_by("position", "pk")
    return JsonResponse({"results": [_cms_video_payload(item) for item in videos], "total": videos.count()})


@require_http_methods(["PATCH"])
@never_cache
@csrf_protect
def cms_work_video_update(request, work_id, video_id):
    """Update a YouTube URL and refresh its metadata, matching Django Admin behavior."""
    if not request.user.is_authenticated:
        return JsonResponse({"error": "authentication_required"}, status=401)
    if not request.user.is_staff:
        return JsonResponse({"error": "staff_required"}, status=403)
    if not request.user.has_perm("portfolio.change_work"):
        return JsonResponse({"error": "work_edit_permission_required"}, status=403)
    try:
        video = WorkVideo.objects.get(pk=video_id, work_id=work_id)
    except WorkVideo.DoesNotExist:
        return JsonResponse({"error": "video_not_found"}, status=404)
    if request.content_type != "application/json" or len(request.body) > 8192:
        return JsonResponse({"error": "invalid_request"}, status=400)
    try:
        payload = json.loads(request.body.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        return JsonResponse({"error": "invalid_json"}, status=400)
    youtube_url = payload.get("youtubeUrl") if isinstance(payload, dict) else None
    if not isinstance(youtube_url, str) or not youtube_url.strip() or len(youtube_url) > 500:
        return JsonResponse({"error": "invalid_youtube_url"}, status=400)
    try:
        metadata = fetch_youtube_video_metadata(youtube_url.strip())
    except YouTubeMetadataError as error:
        return JsonResponse({"error": "youtube_metadata_error", "message": str(error)}, status=400)
    if WorkVideo.objects.filter(work_id=work_id, video_id=metadata["video_id"]).exclude(pk=video.pk).exists():
        return JsonResponse({"error": "video_already_attached"}, status=409)
    video.youtube_url = youtube_url.strip()
    video.video_id = metadata["video_id"]
    video.video_title = metadata["title"][:255]
    video.thumbnail_url = metadata["thumbnail_url"]
    video.save(update_fields=["youtube_url", "video_id", "video_title", "thumbnail_url"])
    return JsonResponse(_cms_video_payload(video))


@require_POST
@never_cache
@csrf_protect
def cms_work_video_delete(request, work_id, video_id):
    """Delete a YouTube video only when it belongs to the requested work."""
    if not request.user.is_authenticated:
        return JsonResponse({"error": "authentication_required"}, status=401)
    if not request.user.is_staff:
        return JsonResponse({"error": "staff_required"}, status=403)
    if not request.user.has_perm("portfolio.change_work"):
        return JsonResponse({"error": "work_edit_permission_required"}, status=403)
    try:
        video = WorkVideo.objects.get(pk=video_id, work_id=work_id)
    except WorkVideo.DoesNotExist:
        return JsonResponse({"error": "video_not_found"}, status=404)
    video.delete()
    return JsonResponse({"deleted": video_id})


@require_POST
@never_cache
@csrf_protect
def cms_work_preview(request, work_id):
    """Issue a short-lived, user-bound URL to preview one work on the public site."""
    if not request.user.is_authenticated:
        return JsonResponse({"error": "authentication_required"}, status=401)
    if not request.user.is_staff:
        return JsonResponse({"error": "staff_required"}, status=403)
    if not request.user.has_perm("portfolio.view_work") and not request.user.has_perm("portfolio.change_work"):
        return JsonResponse({"error": "work_view_permission_required"}, status=403)

    try:
        work = Work.objects.get(pk=work_id)
    except Work.DoesNotExist:
        return JsonResponse({"error": "work_not_found"}, status=404)

    token = signing.dumps(
        {"work": work.pk, "user": request.user.pk},
        salt="portfolio.work-preview",
    )
    return JsonResponse({
        "url": request.build_absolute_uri(f"/?preview_token={token}"),
        "expiresIn": 600,
    })


@require_http_methods(["DELETE"])
@never_cache
@csrf_protect
def cms_work_delete(request, work_id):
    """Delete a work when the editor has the matching Django delete permission."""
    if not request.user.is_authenticated:
        return JsonResponse({"error": "authentication_required"}, status=401)
    if not request.user.is_staff:
        return JsonResponse({"error": "staff_required"}, status=403)
    if not request.user.has_perm("portfolio.delete_work"):
        return JsonResponse({"error": "work_delete_permission_required"}, status=403)
    try:
        work = Work.objects.get(pk=work_id)
    except Work.DoesNotExist:
        return JsonResponse({"error": "work_not_found"}, status=404)
    stored_names = []
    if work.image:
        stored_names.append(work.image.name)
    stored_names.extend(work.gallery_images.values_list("image", flat=True))
    work.delete()
    for name in stored_names:
        if name:
            try:
                default_storage.delete(name)
            except Exception:
                logger.exception("Could not delete media for removed CMS work %s", work_id)
    return JsonResponse({"deleted": work_id})


@require_POST
@never_cache
@csrf_protect
def cms_work_bulk_publish(request):
    """Apply the Django Admin publish/unpublish action to selected works."""
    if not request.user.is_authenticated:
        return JsonResponse({"error": "authentication_required"}, status=401)
    if not request.user.is_staff:
        return JsonResponse({"error": "staff_required"}, status=403)
    if not request.user.has_perm("portfolio.change_work"):
        return JsonResponse({"error": "work_edit_permission_required"}, status=403)
    if request.content_type != "application/json" or len(request.body) > 16384:
        return JsonResponse({"error": "invalid_request"}, status=400)
    try:
        payload = json.loads(request.body.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        return JsonResponse({"error": "invalid_json"}, status=400)
    ids = payload.get("ids") if isinstance(payload, dict) else None
    published = payload.get("published") if isinstance(payload, dict) else None
    if not isinstance(ids, list) or not ids or any(type(value) is not int or value <= 0 for value in ids):
        return JsonResponse({"error": "invalid_work_selection"}, status=400)
    if len(ids) != len(set(ids)) or type(published) is not bool:
        return JsonResponse({"error": "invalid_bulk_publication"}, status=400)
    queryset = Work.objects.filter(pk__in=ids)
    if queryset.count() != len(ids):
        return JsonResponse({"error": "work_selection_mismatch"}, status=400)
    updated = queryset.update(is_active=published)
    return JsonResponse({"updated": updated, "published": published})


@require_POST
@never_cache
@csrf_protect
def cms_work_publish(request, work_id):
    """Publish or unpublish one work without changing its editorial metadata."""
    if not request.user.is_authenticated:
        return JsonResponse({"error": "authentication_required"}, status=401)
    if not request.user.is_staff:
        return JsonResponse({"error": "staff_required"}, status=403)
    if not request.user.has_perm("portfolio.change_work"):
        return JsonResponse({"error": "work_edit_permission_required"}, status=403)
    if request.content_type != "application/json":
        return JsonResponse({"error": "application_json_required"}, status=415)
    if len(request.body) > 4096:
        return JsonResponse({"error": "payload_too_large"}, status=413)
    try:
        payload = json.loads(request.body.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        return JsonResponse({"error": "invalid_json"}, status=400)
    if not isinstance(payload, dict) or set(payload) != {"published"} or not isinstance(payload["published"], bool):
        return JsonResponse({"error": "invalid_publication_state"}, status=400)
    try:
        work = Work.objects.get(pk=work_id)
    except Work.DoesNotExist:
        return JsonResponse({"error": "work_not_found"}, status=404)
    work.is_active = payload["published"]
    work.save(update_fields=["is_active"])
    return JsonResponse({"id": work.pk, "published": work.is_active})


@require_http_methods(["GET", "POST", "PATCH"])
@never_cache
@ensure_csrf_cookie
@csrf_protect
def cms_categories(request):
    if not request.user.is_authenticated:
        return JsonResponse({"error": "authentication_required"}, status=401)
    if not request.user.is_staff:
        return JsonResponse({"error": "staff_required"}, status=403)
    if request.method == "GET":
        items = Category.objects.annotate(work_count=Count("works")).order_by("position", "pk")
        return JsonResponse({"results": [{"id": x.pk, "title": x.title, "key": x.key, "position": x.position, "active": x.is_active, "workCount": x.work_count} for x in items]})
    if request.method == "PATCH":
        if not request.user.has_perm("portfolio.change_category"):
            return JsonResponse({"error": "category_edit_permission_required"}, status=403)
        if request.content_type != "application/json" or len(request.body) > 8192:
            return JsonResponse({"error": "invalid_request"}, status=400)
        try:
            payload = json.loads(request.body.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            return JsonResponse({"error": "invalid_json"}, status=400)
        ids = payload.get("ids") if isinstance(payload, dict) else None
        if not isinstance(ids, list) or any(type(value) is not int for value in ids) or len(ids) != len(set(ids)):
            return JsonResponse({"error": "invalid_category_order"}, status=400)
        with transaction.atomic():
            current = list(Category.objects.select_for_update().values_list("pk", flat=True))
            if set(ids) != set(current) or len(ids) != len(current):
                return JsonResponse({"error": "category_order_mismatch"}, status=400)
            for position, item_id in enumerate(ids):
                Category.objects.filter(pk=item_id).update(position=position)
        items = Category.objects.annotate(work_count=Count("works")).order_by("position", "pk")
        return JsonResponse({"results": [{"id": x.pk, "title": x.title, "key": x.key, "position": x.position, "active": x.is_active, "workCount": x.work_count} for x in items]})
    if not request.user.has_perm("portfolio.add_category"):
        return JsonResponse({"error": "category_add_permission_required"}, status=403)
    if request.content_type != "application/json" or len(request.body) > 8192:
        return JsonResponse({"error": "invalid_request"}, status=400)
    try:
        data = json.loads(request.body.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        return JsonResponse({"error": "invalid_json"}, status=400)
    if not isinstance(data, dict) or set(data) - {"title", "key"} or "title" not in data:
        return JsonResponse({"error": "invalid_category_payload"}, status=400)
    title, key = data.get("title"), data.get("key", "")
    if not isinstance(title, str) or not title.strip() or len(title.strip()) > 100:
        return JsonResponse({"error": "invalid_category_title"}, status=400)
    if not isinstance(key, str) or len(key) > 50:
        return JsonResponse({"error": "invalid_category_key"}, status=400)
    key = slugify(key.strip() or title.strip())[:50]
    if not key:
        return JsonResponse({"error": "invalid_category_key"}, status=400)
    if Category.objects.filter(key=key).exists():
        return JsonResponse({"error": "category_key_conflict"}, status=409)
    last = Category.objects.aggregate(value=Max("position"))["value"]
    item = Category.objects.create(title=title.strip(), key=key, position=0 if last is None else last + 1)
    return JsonResponse({"id": item.pk, "title": item.title, "key": item.key, "position": item.position, "active": item.is_active, "workCount": 0}, status=201)


@require_POST
@never_cache
@csrf_protect
def cms_category_work_order(request, category_id):
    """Persist the order of works inside one category as a single atomic operation."""
    if not request.user.is_authenticated:
        return JsonResponse({"error": "authentication_required"}, status=401)
    if not request.user.is_staff:
        return JsonResponse({"error": "staff_required"}, status=403)
    if not request.user.has_perm("portfolio.change_work"):
        return JsonResponse({"error": "work_edit_permission_required"}, status=403)
    if request.content_type != "application/json" or len(request.body) > 32768:
        return JsonResponse({"error": "invalid_request"}, status=400)
    try:
        payload = json.loads(request.body.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        return JsonResponse({"error": "invalid_json"}, status=400)
    work_ids = payload.get("workIds") if isinstance(payload, dict) else None
    if not isinstance(work_ids, list) or any(type(value) is not int for value in work_ids) or len(work_ids) != len(set(work_ids)):
        return JsonResponse({"error": "invalid_work_order"}, status=400)
    try:
        with transaction.atomic():
            category = Category.objects.select_for_update().get(pk=category_id)
            current = list(Work.objects.select_for_update().filter(category=category).order_by("position", "pk").values_list("pk", flat=True))
            if len(work_ids) != len(current) or set(work_ids) != set(current):
                return JsonResponse({"error": "work_order_mismatch"}, status=400)
            for position, work_id in enumerate(work_ids):
                Work.objects.filter(pk=work_id, category=category).update(position=position)
    except Category.DoesNotExist:
        return JsonResponse({"error": "category_not_found"}, status=404)
    works = Work.objects.filter(category_id=category_id).select_related("category").prefetch_related(
        Prefetch("gallery_images", queryset=WorkImage.objects.only("id", "work_id", "image", "position").order_by("position", "pk"), to_attr="cms_gallery_images"),
        Prefetch("youtube_videos", queryset=WorkVideo.objects.only("id", "work_id", "thumbnail_url", "position").order_by("position", "pk"), to_attr="cms_videos"),
    ).order_by("position", "pk")
    results = []
    for item in works:
        image = ""
        if item.image:
            try:
                image = item.image.url
            except (ValueError, OSError):
                image = ""
        if not image:
            image = item.image_url or ""
        if not image and item.cms_gallery_images:
            image = _cms_image_url(item.cms_gallery_images[0].image)
        if not image and item.cms_videos:
            image = item.cms_videos[0].thumbnail_url or ""
        results.append({"id": item.pk, "title": item.title, "position": item.position, "published": item.is_active, "image": image})
    return JsonResponse({"results": results})


@require_POST
@never_cache
@csrf_protect
def cms_category_work_order_preview(request, category_id):
    """Create a short-lived shareable preview for an unsaved category order."""
    if not request.user.is_authenticated:
        return JsonResponse({"error": "authentication_required"}, status=401)
    if not request.user.is_staff or not (request.user.has_perm("portfolio.view_work") or request.user.has_perm("portfolio.change_work")):
        return JsonResponse({"error": "work_view_permission_required"}, status=403)
    if request.content_type != "application/json" or len(request.body) > 32768:
        return JsonResponse({"error": "invalid_request"}, status=400)
    try:
        payload = json.loads(request.body.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        return JsonResponse({"error": "invalid_json"}, status=400)
    work_ids = payload.get("workIds") if isinstance(payload, dict) else None
    if not isinstance(work_ids, list) or any(type(value) is not int for value in work_ids) or len(work_ids) != len(set(work_ids)):
        return JsonResponse({"error": "invalid_work_order"}, status=400)
    try:
        category = Category.objects.get(pk=category_id, is_active=True)
    except Category.DoesNotExist:
        return JsonResponse({"error": "category_not_found"}, status=404)
    current_ids = list(Work.objects.filter(category=category).order_by("position", "pk").values_list("pk", flat=True))
    if len(work_ids) != len(current_ids) or set(work_ids) != set(current_ids):
        return JsonResponse({"error": "work_order_mismatch"}, status=400)
    token = signing.dumps({"category": category.pk, "work_ids": work_ids}, salt="portfolio.category-order-preview")
    return JsonResponse({"url": request.build_absolute_uri(f"/?category_preview_token={token}"), "expiresIn": 600})


@require_http_methods(["POST", "DELETE"])
@never_cache
@csrf_protect
def cms_category_update(request, category_id):
    if not request.user.is_authenticated:
        return JsonResponse({"error": "authentication_required"}, status=401)
    if not request.user.is_staff:
        return JsonResponse({"error": "staff_required"}, status=403)
    if request.method == "DELETE":
        if not request.user.has_perm("portfolio.delete_category"):
            return JsonResponse({"error": "category_delete_permission_required"}, status=403)
        try:
            item = Category.objects.get(pk=category_id)
        except Category.DoesNotExist:
            return JsonResponse({"error": "category_not_found"}, status=404)
        deleted_works = item.works.count()
        item.delete()
        return JsonResponse({"deleted": category_id, "deletedWorks": deleted_works})
    if not request.user.has_perm("portfolio.change_category"):
        return JsonResponse({"error": "category_edit_permission_required"}, status=403)
    if request.content_type != "application/json" or len(request.body) > 8192:
        return JsonResponse({"error": "invalid_request"}, status=400)
    try:
        data = json.loads(request.body.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        return JsonResponse({"error": "invalid_json"}, status=400)
    allowed = {"title", "key", "active", "position"}
    if not isinstance(data, dict) or not data or set(data) - allowed:
        return JsonResponse({"error": "invalid_category_payload"}, status=400)
    try:
        item = Category.objects.get(pk=category_id)
    except Category.DoesNotExist:
        return JsonResponse({"error": "category_not_found"}, status=404)
    if "title" in data:
        value = data["title"]
        if not isinstance(value, str) or not value.strip() or len(value.strip()) > 100:
            return JsonResponse({"error": "invalid_category_title"}, status=400)
        item.title = value.strip()
    if "key" in data:
        value = data["key"]
        if not isinstance(value, str) or len(value) > 50:
            return JsonResponse({"error": "invalid_category_key"}, status=400)
        value = slugify(value.strip())[:50]
        if not value or Category.objects.filter(key=value).exclude(pk=item.pk).exists():
            return JsonResponse({"error": "category_key_conflict"}, status=409)
        item.key = value
    if "active" in data:
        if type(data["active"]) is not bool:
            return JsonResponse({"error": "invalid_category_active"}, status=400)
        item.is_active = data["active"]
    if "position" in data:
        if type(data["position"]) is not int or data["position"] < 0:
            return JsonResponse({"error": "invalid_category_position"}, status=400)
        item.position = data["position"]
    item.save(update_fields=["title", "key", "is_active", "position"])
    return JsonResponse({"id": item.pk, "title": item.title, "key": item.key, "position": item.position, "active": item.is_active, "workCount": item.works.count()})
