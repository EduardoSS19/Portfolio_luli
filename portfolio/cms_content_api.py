"""CMS endpoints for the remaining Django Admin-managed editorial content."""
import json
import logging

from django import forms
from django.core.files.storage import default_storage
from django.db import transaction
from django.http import JsonResponse
from django.views.decorators.cache import never_cache
from django.views.decorators.csrf import csrf_protect, ensure_csrf_cookie
from django.views.decorators.http import require_http_methods

from .cms_api import (
    ALLOWED_COVER_FORMATS,
    MAX_COVER_UPLOAD_SIZE,
    _cms_image_url,
    _staff_required,
    _validate_cms_gallery_image,
)
from .models import BackgroundFrame, Reference, ReferenceLink, SocialLink

logger = logging.getLogger(__name__)


class SocialLinkForm(forms.ModelForm):
    class Meta:
        model = SocialLink
        fields = ("title", "url", "position", "is_active")


class ReferenceForm(forms.ModelForm):
    class Meta:
        model = Reference
        fields = ("title", "period", "position", "is_active")


class ReferenceLinkForm(forms.ModelForm):
    class Meta:
        model = ReferenceLink
        fields = ("text", "url", "position")


def _content_model(content_type):
    return {
        "social-links": (SocialLink, "sociallink"),
        "backgrounds": (BackgroundFrame, "backgroundframe"),
        "references": (Reference, "reference"),
    }.get(content_type)


def _content_permissions(user, model_name):
    return {
        "canView": user.has_perm(f"portfolio.view_{model_name}") or user.has_perm(f"portfolio.change_{model_name}"),
        "canAdd": user.has_perm(f"portfolio.add_{model_name}"),
        "canChange": user.has_perm(f"portfolio.change_{model_name}"),
        "canDelete": user.has_perm(f"portfolio.delete_{model_name}"),
    }


def _serialize_content(content_type, item):
    if content_type == "social-links":
        return {
            "id": item.pk, "title": item.title, "url": item.url,
            "position": item.position, "active": item.is_active,
        }
    if content_type == "backgrounds":
        return {
            "id": item.pk, "image": _cms_image_url(item.image),
            "position": item.position, "active": item.is_active,
        }
    return {
        "id": item.pk, "title": item.title, "period": item.period,
        "position": item.position, "active": item.is_active,
        "links": [{
            "id": link.pk, "text": link.text, "url": link.url,
            "position": link.position,
        } for link in item.links.all().order_by("position", "pk")],
    }


def _content_queryset(content_type):
    if content_type == "references":
        return Reference.objects.prefetch_related("links").order_by("position", "pk")
    return _content_model(content_type)[0].objects.order_by("position", "pk")


@require_http_methods(["GET", "POST", "PATCH"])
@never_cache
@ensure_csrf_cookie
@csrf_protect
@_staff_required
def cms_content(request):
    content_type = request.GET.get("type", "") if request.method == "GET" else ""
    if request.method != "GET":
        try:
            payload = json.loads(request.body.decode("utf-8")) if request.content_type == "application/json" else {}
        except (UnicodeDecodeError, json.JSONDecodeError):
            return JsonResponse({"error": "invalid_json"}, status=400)
        content_type = (payload.get("type", "") if isinstance(payload, dict) else "") or request.GET.get("type", "")
    if content_type not in {"social-links", "backgrounds", "references"}:
        return JsonResponse({"error": "invalid_content_type"}, status=400)

    model, model_name = _content_model(content_type)
    permissions = _content_permissions(request.user, model_name)

    if request.method == "GET":
        items = [_serialize_content(content_type, item) for item in _content_queryset(content_type)]
        return JsonResponse({"results": items, "permissions": permissions})

    if request.method == "PATCH":
        if not permissions["canChange"]:
            return JsonResponse({"error": "content_change_permission_required"}, status=403)
        ids = payload.get("ids") if isinstance(payload, dict) else None
        if not isinstance(ids, list) or any(type(value) is not int for value in ids):
            return JsonResponse({"error": "invalid_order"}, status=400)
        if len(ids) != len(set(ids)):
            return JsonResponse({"error": "duplicate_ids"}, status=400)
        with transaction.atomic():
            current = list(model.objects.select_for_update().values_list("pk", flat=True))
            if set(ids) != set(current) or len(ids) != len(current):
                return JsonResponse({"error": "order_mismatch"}, status=400)
            for position, item_id in enumerate(ids):
                model.objects.filter(pk=item_id).update(position=position)
        return JsonResponse({"results": [_serialize_content(content_type, item) for item in _content_queryset(content_type)]})

    if not permissions["canAdd"]:
        return JsonResponse({"error": "content_add_permission_required"}, status=403)

    if content_type == "backgrounds":
        if not request.content_type.startswith("multipart/form-data"):
            return JsonResponse({"error": "multipart_form_data_required"}, status=415)
        uploads = request.FILES.getlist("images")
        if not uploads or set(request.FILES.keys()) != {"images"}:
            return JsonResponse({"error": "images_required"}, status=400)
        if len(uploads) > 30:
            return JsonResponse({"error": "too_many_images"}, status=400)
        for uploaded in uploads:
            error = _validate_cms_gallery_image(uploaded)
            if error:
                return JsonResponse({"error": error, "maxBytes": MAX_COVER_UPLOAD_SIZE}, status=413 if error == "image_too_large" else 400)
        last = BackgroundFrame.objects.order_by("-position").values_list("position", flat=True).first()
        position = 0 if last is None else last + 1
        created = []
        stored_names = []
        try:
            for uploaded in uploads:
                uploaded.seek(0)
                from PIL import Image
                with Image.open(uploaded) as image:
                    extension = ALLOWED_COVER_FORMATS[image.format]
                uploaded.seek(0)
                item = BackgroundFrame(position=position, is_active=True)
                item.image.save(f"background-{position + 1}.{extension}", uploaded, save=False)
                stored_names.append(item.image.name)
                item.save()
                created.append(item)
                position += 1
        except Exception:
            for name in stored_names:
                try:
                    default_storage.delete(name)
                except Exception:
                    logger.exception("Failed cleaning up CMS background upload %s", name)
            logger.exception("CMS background batch upload failed")
            return JsonResponse({"error": "image_storage_failed"}, status=503)
        return JsonResponse({"results": [_serialize_content(content_type, item) for item in created]}, status=201)

    if content_type == "social-links":
        form = SocialLinkForm(payload)
        if not form.is_valid():
            return JsonResponse({"error": "validation_error", "fields": form.errors.get_json_data()}, status=400)
        item = form.save()
    else:
        data = {key: value for key, value in payload.items() if key in {"title", "period", "position", "is_active"}}
        form = ReferenceForm(data)
        links = payload.get("links", [])
        if not isinstance(links, list) or len(links) > 50:
            return JsonResponse({"error": "invalid_reference_links"}, status=400)
        if not form.is_valid():
            return JsonResponse({"error": "validation_error", "fields": form.errors.get_json_data()}, status=400)
        link_forms = [ReferenceLinkForm({**link, "position": index}) for index, link in enumerate(links) if isinstance(link, dict)]
        if len(link_forms) != len(links) or any(not link_form.is_valid() for link_form in link_forms):
            return JsonResponse({"error": "invalid_reference_links", "fields": [link_form.errors.get_json_data() for link_form in link_forms]}, status=400)
        with transaction.atomic():
            item = form.save()
            for link_form in link_forms:
                link = link_form.save(commit=False)
                link.reference = item
                link.save()
    return JsonResponse({"result": _serialize_content(content_type, item)}, status=201)


@require_http_methods(["PATCH", "DELETE"])
@never_cache
@ensure_csrf_cookie
@csrf_protect
@_staff_required
def cms_content_detail(request, content_type, item_id):
    if content_type not in {"social-links", "backgrounds", "references"}:
        return JsonResponse({"error": "invalid_content_type"}, status=400)
    model, model_name = _content_model(content_type)
    try:
        item = _content_queryset(content_type).get(pk=item_id)
    except model.DoesNotExist:
        return JsonResponse({"error": "content_not_found"}, status=404)
    permissions = _content_permissions(request.user, model_name)

    if request.method == "DELETE":
        if not permissions["canDelete"]:
            return JsonResponse({"error": "content_delete_permission_required"}, status=403)
        image_name = item.image.name if content_type == "backgrounds" and item.image else ""
        item.delete()
        if image_name:
            try:
                default_storage.delete(image_name)
            except Exception:
                logger.exception("Could not delete removed CMS background %s", image_name)
        return JsonResponse({"deleted": True, "id": item_id})

    if not permissions["canChange"]:
        return JsonResponse({"error": "content_change_permission_required"}, status=403)
    try:
        payload = json.loads(request.body.decode("utf-8")) if request.content_type == "application/json" else None
    except (UnicodeDecodeError, json.JSONDecodeError):
        return JsonResponse({"error": "invalid_json"}, status=400)
    if not isinstance(payload, dict) or len(request.body) > 65536:
        return JsonResponse({"error": "invalid_payload"}, status=400)

    if content_type == "social-links":
        form = SocialLinkForm(payload, instance=item)
        if not form.is_valid():
            return JsonResponse({"error": "validation_error", "fields": form.errors.get_json_data()}, status=400)
        item = form.save()
    elif content_type == "backgrounds":
        allowed = {"position", "is_active"}
        if set(payload) - allowed:
            return JsonResponse({"error": "unknown_fields"}, status=400)
        for field in allowed & set(payload):
            setattr(item, field, payload[field])
        try:
            item.full_clean()
        except forms.ValidationError as error:
            return JsonResponse({"error": "validation_error", "fields": error.message_dict}, status=400)
        item.save(update_fields=list(allowed & set(payload)))
    else:
        data = {key: value for key, value in payload.items() if key in {"title", "period", "position", "is_active"}}
        form = ReferenceForm(data, instance=item)
        links = payload.get("links")
        if not form.is_valid():
            return JsonResponse({"error": "validation_error", "fields": form.errors.get_json_data()}, status=400)
        link_forms = None
        if links is not None:
            if not isinstance(links, list) or len(links) > 50:
                return JsonResponse({"error": "invalid_reference_links"}, status=400)
            link_forms = [ReferenceLinkForm({**link, "position": index}) for index, link in enumerate(links) if isinstance(link, dict)]
            if len(link_forms) != len(links) or any(not link_form.is_valid() for link_form in link_forms):
                return JsonResponse({"error": "invalid_reference_links", "fields": [link_form.errors.get_json_data() for link_form in link_forms]}, status=400)
        with transaction.atomic():
            item = form.save()
            if link_forms is not None:
                item.links.all().delete()
                for link_form in link_forms:
                    link = link_form.save(commit=False)
                    link.reference = item
                    link.save()
    return JsonResponse({"result": _serialize_content(content_type, item)})


@require_POST
@never_cache
@csrf_protect
@_staff_required
def cms_content_toggle(request, content_type, item_id):
    if content_type not in {"social-links", "backgrounds", "references"}:
        return JsonResponse({"error": "invalid_content_type"}, status=400)
    model, model_name = _content_model(content_type)
    if not request.user.has_perm(f"portfolio.change_{model_name}"):
        return JsonResponse({"error": "content_change_permission_required"}, status=403)
    try:
        item = model.objects.get(pk=item_id)
    except model.DoesNotExist:
        return JsonResponse({"error": "content_not_found"}, status=404)
    item.is_active = not item.is_active
    item.save(update_fields=["is_active"])
    return JsonResponse({"result": _serialize_content(content_type, item)})
