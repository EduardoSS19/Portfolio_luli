from io import BytesIO

from PIL import Image
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from django.test import override_settings
from django.urls import reverse
from django.contrib.auth import get_user_model

from .models import ArtistProfile, Category, Reference, Work


class PortfolioApiTests(TestCase):
    def setUp(self):
        Category.objects.all().delete()
        Reference.objects.all().delete()
        ArtistProfile.objects.all().delete()

    def test_portfolio_endpoint_returns_frontend_shape(self):
        category = Category.objects.create(title="Desenho", key="desenho")
        Work.objects.create(
            category=category,
            title="Gaiola",
            image_url="/gaiola.jpg",
            description="Grafite",
            detail="A3",
        )
        reference = Reference.objects.create(title="Exposição", period="2025")
        reference.links.create(text="Site", url="https://example.com")
        ArtistProfile.objects.create(
            name="Luísa Becker",
            photo_url="/sobre/luisa.jpg",
            bio="Primeiro parágrafo.\n\nSegundo parágrafo.",
        )

        response = self.client.get(reverse("portfolio-data"))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {
            "sobre": {
                "nome": "Luísa Becker",
                "foto": "/static/sobre/luisa.jpg",
                "bio": ["Primeiro parágrafo.", "Segundo parágrafo."],
            },
            "categorias": [{
                "titulo": "Desenho",
                "chave": "desenho",
                "obras": [{
                    "titulo": "Gaiola",
                    "imagem": "/static/gaiola.jpg",
                    "descricao": "Grafite",
                    "detalhe": "A3",
                }],
            }],
            "referencias": [{
                "titulo": "Exposição",
                "periodo": "2025",
                "links": [{"texto": "Site", "url": "https://example.com"}],
            }],
        })

    def test_inactive_content_is_not_public(self):
        category = Category.objects.create(title="Oculta", key="oculta", is_active=False)
        Work.objects.create(category=category, title="Rascunho")
        Reference.objects.create(title="Oculta", is_active=False)

        response = self.client.get(reverse("portfolio-data"))

        self.assertEqual(response.json(), {"sobre": None, "categorias": [], "referencias": []})

    def test_admin_profile_form_has_photo_upload_and_bio(self):
        profile = ArtistProfile.objects.create(name="Luísa Becker", bio="Biografia.")
        admin_user = get_user_model().objects.create_superuser(
            username="testadmin",
            email="admin@example.com",
            password="test-password-123",
        )
        self.client.force_login(admin_user)

        response = self.client.get(
            reverse("admin:portfolio_artistprofile_change", args=[profile.pk])
        )

        self.assertContains(response, 'type="file"')
        self.assertContains(response, 'name="name"')
        self.assertContains(response, 'name="bio"')

    def test_local_image_path_uses_static_prefix(self):
        category = Category.objects.create(title="Desenho", key="desenho")
        Work.objects.create(category=category, title="Gaiola", image_url="/gaiola.jpg")

        response = self.client.get(reverse("portfolio-data"))

        self.assertEqual(
            response.json()["categorias"][0]["obras"][0]["imagem"],
            "/static/gaiola.jpg",
        )

    def test_uploaded_profile_photo_uses_media_url(self):
        profile = ArtistProfile.objects.create(
            name="Luísa Becker",
            photo="sobre/2026/09/luisa.webp",
            bio="Biografia.",
        )

        response = self.client.get(reverse("portfolio-data"))

        self.assertEqual(response.json()["sobre"]["foto"], profile.photo.url)

    def test_uploaded_image_url_is_returned(self):
        category = Category.objects.create(title="Desenho", key="desenho")
        Work.objects.create(
            category=category,
            title="Gaiola",
            image="obras/2026/09/gaiola.webp",
        )

        response = self.client.get(reverse("portfolio-data"))

        self.assertEqual(
            response.json()["categorias"][0]["obras"][0]["imagem"],
            "/media/obras/2026/09/gaiola.webp",
        )

    def test_uploaded_image_is_saved_and_served(self):
        category = Category.objects.create(title="Desenho", key="desenho")
        image_bytes = BytesIO()
        Image.new("RGB", (1, 1), color="black").save(image_bytes, format="PNG")
        uploaded_image = SimpleUploadedFile(
            "gaiola.png",
            image_bytes.getvalue(),
            content_type="image/png",
        )
        work = Work.objects.create(
            category=category,
            title="Gaiola",
            image=uploaded_image,
        )
        self.addCleanup(work.image.storage.delete, work.image.name)

        self.assertTrue(work.image.storage.exists(work.image.name))
        self.assertEqual(work.image.url, f"/media/{work.image.name}")

    def test_admin_work_form_has_file_upload_input(self):
        category = Category.objects.create(title="Desenho", key="desenho")
        Work.objects.create(category=category, title="Gaiola")
        admin_user = get_user_model().objects.create_superuser(
            username="testadmin",
            email="admin@example.com",
            password="test-password-123",
        )
        self.client.force_login(admin_user)

        response = self.client.get(
            reverse("admin:portfolio_category_change", args=[category.pk])
        )

        self.assertContains(response, 'type="file"')

    def test_healthcheck_returns_ok(self):
        response = self.client.get(reverse("healthcheck"))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "ok"})

    @override_settings(DEBUG=True)
    def test_debug_root_redirects_to_vite(self):
        response = self.client.get(reverse("frontend"))

        self.assertRedirects(
            response,
            "http://127.0.0.1:5173/",
            fetch_redirect_response=False,
        )