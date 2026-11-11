import json
from io import BytesIO
from tempfile import TemporaryDirectory

from PIL import Image
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Permission
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from django.urls import reverse

from .models import BackgroundFrame, Reference, SocialLink


class CmsContentApiTests(TestCase):
    def setUp(self):
        user_model = get_user_model()
        self.user = user_model.objects.create_user(
            username="cms-editor", password="test-password", is_staff=True
        )
        self.client.login(username="cms-editor", password="test-password")
        self.url = reverse("cms-content")

    def grant(self, *codenames):
        permissions = Permission.objects.filter(
            content_type__app_label="portfolio", codename__in=codenames
        )
        self.user.user_permissions.add(*permissions)

    def post_json(self, payload):
        return self.client.post(
            self.url, data=json.dumps(payload), content_type="application/json"
        )

    def test_social_links_crud_and_activation_preserve_admin_fields(self):
        self.grant("add_sociallink", "change_sociallink", "delete_sociallink")
        response = self.post_json({
            "type": "social-links", "title": "Behance",
            "url": "https://behance.net/example", "position": 3, "is_active": True,
        })
        self.assertEqual(response.status_code, 201)
        item_id = response.json()["result"]["id"]

        response = self.client.post(
            reverse("cms-content-toggle", args=["social-links", item_id])
        )
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.json()["result"]["active"])

        response = self.client.patch(
            reverse("cms-content-detail", args=["social-links", item_id]),
            data=json.dumps({"title": "Portfólio", "url": "https://example.com", "position": 0, "is_active": True}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["result"]["title"], "Portfólio")

        response = self.client.delete(reverse("cms-content-detail", args=["social-links", item_id]))
        self.assertEqual(response.status_code, 200)
        self.assertFalse(SocialLink.objects.filter(pk=item_id).exists())

    def test_reference_create_and_edit_manages_nested_links(self):
        self.grant("add_reference", "change_reference")
        response = self.post_json({
            "type": "references", "title": "Mostra coletiva", "period": "2026",
            "position": 0, "is_active": True,
            "links": [{"text": "Catálogo", "url": "https://example.com/catalogo"}],
        })
        self.assertEqual(response.status_code, 201)
        item_id = response.json()["result"]["id"]
        self.assertEqual(Reference.objects.get(pk=item_id).links.count(), 1)

        response = self.client.patch(
            reverse("cms-content-detail", args=["references", item_id]),
            data=json.dumps({
                "title": "Mostra individual", "period": "2027", "position": 2,
                "is_active": False,
                "links": [{"text": "Registro", "url": "https://example.com/registro"}],
            }),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        reference = Reference.objects.get(pk=item_id)
        self.assertEqual(reference.title, "Mostra individual")
        self.assertEqual(reference.links.get().text, "Registro")
        self.assertFalse(reference.is_active)

    def test_order_requires_exact_collection_membership_and_change_permission(self):
        self.grant("change_sociallink")
        first = SocialLink.objects.create(title="A", url="https://a.example", position=0)
        second = SocialLink.objects.create(title="B", url="https://b.example", position=1)
        response = self.client.patch(
            self.url,
            data=json.dumps({"type": "social-links", "ids": [second.pk, first.pk]}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        first.refresh_from_db()
        second.refresh_from_db()
        self.assertEqual(second.position, 0)
        self.assertEqual(first.position, 1)

        response = self.client.patch(
            self.url,
            data=json.dumps({"type": "social-links", "ids": [first.pk]}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 400)

    def test_content_endpoints_enforce_django_permissions(self):
        response = self.post_json({
            "type": "social-links", "title": "Instagram",
            "url": "https://instagram.com/example",
        })
        self.assertEqual(response.status_code, 403)
        self.assertFalse(SocialLink.objects.exists())

    def test_background_batch_upload_validates_and_stores_multiple_images(self):
        self.grant("add_backgroundframe")
        with TemporaryDirectory() as media_root:
            with override_settings(MEDIA_ROOT=media_root):
                files = []
                for name in ("first.png", "second.png"):
                    output = BytesIO()
                    Image.new("RGB", (8, 8), "white").save(output, format="PNG")
                    files.append(SimpleUploadedFile(name, output.getvalue(), content_type="image/png"))
                response = self.client.post(
                    self.url + "?type=backgrounds",
                    data={"images": files},
                )
                self.assertEqual(response.status_code, 201, response.content)
                self.assertEqual(BackgroundFrame.objects.count(), 2)
                self.assertEqual(
                    list(BackgroundFrame.objects.order_by("position").values_list("position", flat=True)),
                    [0, 1],
                )
