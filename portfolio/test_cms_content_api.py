import json
from io import BytesIO
from tempfile import TemporaryDirectory

from PIL import Image
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Permission
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from django.test.client import MULTIPART_CONTENT
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

    def test_background_listing_exposes_image_url_and_replacement_preserves_item(self):
        from django.core.files.storage import default_storage

        self.grant("view_backgroundframe", "change_backgroundframe")
        with TemporaryDirectory() as media_root, override_settings(MEDIA_ROOT=media_root):
            def image_upload(name, color):
                output = BytesIO()
                Image.new("RGB", (12, 8), color).save(output, format="PNG")
                return SimpleUploadedFile(name, output.getvalue(), content_type="image/png")

            background = BackgroundFrame.objects.create(
                image=image_upload("original.png", "red"), position=2, is_active=True,
            )
            old_name = background.image.name
            listing = self.client.get(self.url + "?type=backgrounds")
            self.assertEqual(listing.status_code, 200)
            image_url = listing.json()["results"][0]["image"]
            self.assertTrue(image_url)
            self.assertIn(old_name, image_url)

            response = self.client.patch(
                reverse("cms-content-detail", args=["backgrounds", background.pk]),
                data={"image": image_upload("replacement.png", "blue")},
                content_type=MULTIPART_CONTENT,
            )
            self.assertEqual(response.status_code, 200, response.content)
            background.refresh_from_db()
            self.assertEqual(background.position, 2)
            self.assertTrue(background.is_active)
            self.assertNotEqual(background.image.name, old_name)
            self.assertTrue(default_storage.exists(background.image.name))
            self.assertFalse(default_storage.exists(old_name))
            self.assertEqual(response.json()["result"]["id"], background.pk)
            self.assertIn(background.image.name, response.json()["result"]["image"])

    def test_background_replacement_requires_change_permission(self):
        background = BackgroundFrame.objects.create(image="fundos/existing.png")
        output = BytesIO()
        Image.new("RGB", (8, 8), "blue").save(output, format="PNG")
        upload = SimpleUploadedFile("replacement.png", output.getvalue(), content_type="image/png")
        response = self.client.patch(
            reverse("cms-content-detail", args=["backgrounds", background.pk]),
            data={"image": upload},
        )
        self.assertEqual(response.status_code, 403)
        background.refresh_from_db()
        self.assertEqual(background.image.name, "fundos/existing.png")

    def test_reference_listing_returns_existing_records_and_nested_links(self):
        self.grant("view_reference")
        reference = Reference.objects.create(title="Exposição coletiva", period="2026")
        reference.links.create(text="Catálogo", url="https://example.com/catalogo")

        response = self.client.get(self.url + "?type=references")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["results"][0]["title"], "Exposição coletiva")
        self.assertEqual(response.json()["results"][0]["links"][0]["text"], "Catálogo")

    def test_content_listing_requires_django_view_or_change_permission(self):
        response = self.client.get(self.url + "?type=social-links")
        self.assertEqual(response.status_code, 403)
        self.grant("view_sociallink")
        response = self.client.get(self.url + "?type=social-links")
        self.assertEqual(response.status_code, 200)

    def test_work_share_image_url_and_bulk_publication_are_available_in_cms(self):
        from .models import Category, Work

        self.grant("add_work", "change_work")
        category = Category.objects.create(title="Pintura", key="pintura")
        first = Work.objects.create(
            category=category, title="Primeira", image_url="https://example.com/first.jpg",
            is_share_image=True, is_active=False,
        )
        response = self.client.post(
            reverse("cms-work-create"),
            data=json.dumps({
                "category": category.pk, "title": "Segunda", "position": 1,
                "image_url": "https://example.com/second.jpg", "is_share_image": True,
            }),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 201, response.content)
        first.refresh_from_db()
        second = Work.objects.get(pk=response.json()["id"])
        self.assertFalse(first.is_share_image)
        self.assertTrue(second.is_share_image)

        response = self.client.post(
            reverse("cms-work-bulk-publish"),
            data=json.dumps({"ids": [first.pk, second.pk], "published": True}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["updated"], 2)
        self.assertEqual(Work.objects.filter(pk__in=[first.pk, second.pk], is_active=True).count(), 2)

    def test_category_order_and_cascade_delete_are_available(self):
        from .models import Category, Work

        Category.objects.all().delete()
        self.grant("change_category", "delete_category")
        first = Category.objects.create(title="A", key="cms-a", position=0)
        second = Category.objects.create(title="B", key="cms-b", position=1)
        work = Work.objects.create(category=first, title="Obra da categoria")
        response = self.client.patch(
            reverse("cms-categories"),
            data=json.dumps({"ids": [second.pk, first.pk]}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        second.refresh_from_db()
        self.assertEqual(second.position, 0)

        response = self.client.delete(reverse("cms-category-update", args=[first.pk]))
        self.assertEqual(response.status_code, 200)
        self.assertFalse(Category.objects.filter(pk=first.pk).exists())
        self.assertFalse(Work.objects.filter(pk=work.pk).exists())

    def test_gallery_image_can_be_replaced_without_changing_position(self):
        from .models import Category, Work, WorkImage

        self.grant("change_work")
        category = Category.objects.create(title="Foto", key="cms-photo")
        work = Work.objects.create(category=category, title="Obra")
        old = WorkImage.objects.create(work=work, image="obras/old-gallery.png", position=4)
        output = BytesIO()
        Image.new("RGB", (10, 10), "purple").save(output, format="PNG")
        upload = SimpleUploadedFile("replacement.png", output.getvalue(), content_type="image/png")
        with TemporaryDirectory() as media_root, override_settings(MEDIA_ROOT=media_root):
            response = self.client.post(
                reverse("cms-work-gallery-item", args=[work.pk, old.pk]),
                data={"image": upload},
            )
            self.assertEqual(response.status_code, 200, response.content)
            old.refresh_from_db()
            self.assertEqual(old.position, 4)
            self.assertTrue(old.image.name.endswith(".png"))

    def test_existing_video_url_can_be_updated_with_fresh_metadata(self):
        from unittest.mock import patch
        from .models import Category, Work, WorkVideo

        self.grant("change_work")
        category = Category.objects.create(title="Vídeo", key="cms-video-update")
        work = Work.objects.create(category=category, title="Obra")
        video = WorkVideo.objects.create(
            work=work, youtube_url="https://youtu.be/OldVideo123",
            video_id="OldVideo123", video_title="Título antigo",
            thumbnail_url="https://example.com/old.jpg",
        )
        metadata = {
            "video_id": "NewVideo123", "title": "Título novo",
            "thumbnail_url": "https://example.com/new.jpg",
        }
        with patch("portfolio.cms_api.fetch_youtube_video_metadata", return_value=metadata):
            response = self.client.patch(
                reverse("cms-work-video-update", args=[work.pk, video.pk]),
                data=json.dumps({"youtubeUrl": "https://youtu.be/NewVideo123"}),
                content_type="application/json",
            )
        self.assertEqual(response.status_code, 200)
        video.refresh_from_db()
        self.assertEqual(video.video_id, "NewVideo123")
        self.assertEqual(video.video_title, "Título novo")

    def test_work_deletion_requires_delete_permission(self):
        from .models import Category, Work

        category = Category.objects.create(title="Excluir", key="cms-delete-work")
        work = Work.objects.create(category=category, title="Obra")
        response = self.client.delete(reverse("cms-work-delete", args=[work.pk]))
        self.assertEqual(response.status_code, 403)
        self.grant("delete_work")
        response = self.client.delete(reverse("cms-work-delete", args=[work.pk]))
        self.assertEqual(response.status_code, 200)
        self.assertFalse(Work.objects.filter(pk=work.pk).exists())
