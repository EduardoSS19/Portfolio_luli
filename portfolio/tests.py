from io import BytesIO
import json
from pathlib import Path
from tempfile import TemporaryDirectory
import os
from unittest.mock import MagicMock, patch

from PIL import Image
from django.core import mail
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from django.test import Client, RequestFactory, TestCase
from django.test import override_settings
from django.urls import reverse
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group

from .models import (
    ArtistProfile,
    BackgroundFrame,
    Category,
    Reference,
    SocialLink,
    Work,
    WorkImage,
    WorkVideo,
)
from .youtube import YouTubeMetadataError, extract_youtube_video_id, fetch_youtube_video_metadata
from .views import frontend


class PortfolioApiTests(TestCase):
    def setUp(self):
        Category.objects.all().delete()
        Reference.objects.all().delete()
        ArtistProfile.objects.all().delete()
        BackgroundFrame.objects.all().delete()

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
            tagline="Cerâmica e desenho",
            photo_url="/sobre/luisa.jpg",
            bio="Primeiro parágrafo.\n\nSegundo parágrafo.",
            instagram_url="https://instagram.com/artista",
            contact_email="artista@example.com",
            contact_form_url="https://formspree.io/f/example",
        )
        BackgroundFrame.objects.create(image="fundos/2026/09/frame.webp")
        SocialLink.objects.create(title="Behance", url="https://behance.net/artista")

        response = self.client.get(reverse("portfolio-data"))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {
            "sobre": {
                "nome": "Luísa Becker",
                "frase": "Cerâmica e desenho",
                "foto": "/static/sobre/luisa.jpg",
                "instagram": "https://instagram.com/artista",
                "email": "artista@example.com",
                "formulario": "https://formspree.io/f/example",
                "bio": "Primeiro parágrafo.\n\nSegundo parágrafo.",
            },
            "frames": ["/media/fundos/2026/09/frame.webp"],
            "redes": [{"titulo": "Behance", "url": "https://behance.net/artista"}],
            "categorias": [{
                "titulo": "Desenho",
                "chave": "desenho",
                "obras": [{
                    "titulo": "Gaiola",
                    "imagem": "/static/gaiola.jpg",
                    "imagens": ["/static/gaiola.jpg"],
                    "midias": [{"tipo": "imagem", "src": "/static/gaiola.jpg"}],
                    "descricao": "Grafite",
                    "detalhe": "A3",
                    "fichaTecnica": {
                        "tecnica": "",
                        "material": "",
                        "suporte": "",
                        "ano": None,
                        "dimensoes": {
                            "altura": "",
                            "largura": "",
                            "profundidade": "",
                            "unidade": "cm",
                        },
                        "preco": "",
                        "moeda": "BRL",
                        "disponibilidade": "",
                        "serie": "",
                        "edicao": "",
                        "tiragem": "",
                        "assinada": None,
                        "localCriacao": "",
                        "conservacao": "",
                        "exposicoes": "",
                    },
                }],
            }],
            "referencias": [{
                "titulo": "Exposição",
                "periodo": "2025",
                "links": [{"texto": "Site", "url": "https://example.com"}],
            }],
        })

    def test_bio_preserves_single_and_multiple_manual_line_breaks(self):
        ArtistProfile.objects.create(
            name="Luísa Becker",
            bio="Primeira linha\nSegunda linha\n\nNovo parágrafo",
        )

        response = self.client.get(reverse("portfolio-data"))

        self.assertEqual(
            response.json()["sobre"]["bio"],
            "Primeira linha\nSegunda linha\n\nNovo parágrafo",
        )

    def test_inactive_content_is_not_public(self):
        category = Category.objects.create(title="Oculta", key="oculta", is_active=False)
        Work.objects.create(category=category, title="Rascunho")
        Reference.objects.create(title="Oculta", is_active=False)

        response = self.client.get(reverse("portfolio-data"))

        self.assertEqual(
            response.json(),
            {"sobre": None, "frames": [], "redes": [], "categorias": [], "referencias": []},
        )

    @override_settings(
        EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
        DEFAULT_FROM_EMAIL="portfolio@example.com",
    )
    def test_contact_endpoint_sends_message_to_profile_email(self):
        ArtistProfile.objects.create(
            name="Luísa Becker",
            bio="Biografia.",
            contact_email="artista@example.com",
        )

        response = self.client.post(
            reverse("contact"),
            data=json.dumps({
                "nome": "Ana",
                "email": "ana@example.com",
                "assunto": "Projeto",
                "mensagem": "Olá, gostaria de conversar.",
            }),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "ok"})
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, ["artista@example.com"])
        self.assertEqual(mail.outbox[0].reply_to, ["ana@example.com"])
        self.assertIn("Olá, gostaria de conversar.", mail.outbox[0].body)

    def test_contact_endpoint_rejects_invalid_email(self):
        response = self.client.post(
            reverse("contact"),
            data={
                "nome": "Ana",
                "email": "email-inválido",
                "mensagem": "Olá.",
            },
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["erro"], "Informe um endereço de e-mail válido.")

    def test_contact_endpoint_ignores_honeypot_submission(self):
        response = self.client.post(
            reverse("contact"),
            data={
                "nome": "Spam",
                "email": "spam@example.com",
                "mensagem": "Spam.",
                "website": "https://spam.example",
            },
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "ok"})
        self.assertEqual(len(mail.outbox), 0)

    @override_settings(
        EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
        DEFAULT_FROM_EMAIL="portfolio@example.com",
    )
    def test_contact_endpoint_accepts_csrf_protected_request(self):
        ArtistProfile.objects.create(
            name="Luísa Becker",
            bio="Biografia.",
            contact_email="artista@example.com",
        )
        client = Client(enforce_csrf_checks=True)
        client.get(reverse("portfolio-data"))
        csrf_token = client.cookies["csrftoken"].value

        response = client.post(
            reverse("contact"),
            data=json.dumps({
                "nome": "Ana",
                "email": "ana@example.com",
                "mensagem": "Olá.",
            }),
            content_type="application/json",
            HTTP_X_CSRFTOKEN=csrf_token,
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(mail.outbox), 1)

    @override_settings(
        EMAIL_BACKEND="django.core.mail.backends.smtp.EmailBackend",
        EMAIL_HOST="",
        DEFAULT_FROM_EMAIL="",
    )
    def test_contact_endpoint_reports_missing_smtp_configuration(self):
        ArtistProfile.objects.create(
            name="Luísa Becker",
            bio="Biografia.",
            contact_email="artista@example.com",
        )

        response = self.client.post(
            reverse("contact"),
            data={
                "nome": "Ana",
                "email": "ana@example.com",
                "mensagem": "Olá.",
            },
        )

        self.assertEqual(response.status_code, 503)
        self.assertEqual(len(mail.outbox), 0)

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

    def test_background_frames_can_be_uploaded_in_admin(self):
        admin_user = get_user_model().objects.create_superuser(
            username="testadmin",
            email="admin@example.com",
            password="test-password-123",
        )
        self.client.force_login(admin_user)

        response = self.client.get(reverse("admin:portfolio_backgroundframe_add"))

        self.assertContains(response, 'type="file"')

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

    def test_portfolio_api_includes_only_optional_work_metadata_values(self):
        category = Category.objects.create(title="Cerâmica", key="ceramica-meta")
        work = Work.objects.create(
            category=category,
            title="Vaso",
            technique="Torno",
            material="Argila",
            year=2024,
            height="20.00",
            width="12.50",
            dimension_unit="cm",
            price="350.00",
            currency="BRL",
            availability="available",
        )

        response = self.client.get(reverse("portfolio-data"))
        ficha = response.json()["categorias"][0]["obras"][0]["fichaTecnica"]

        self.assertEqual(ficha["tecnica"], "Torno")
        self.assertEqual(ficha["material"], "Argila")
        self.assertEqual(ficha["ano"], 2024)
        self.assertEqual(ficha["dimensoes"]["altura"], "20.00")
        self.assertEqual(ficha["dimensoes"]["largura"], "12.50")
        self.assertEqual(ficha["preco"], "350.00")
        self.assertEqual(ficha["disponibilidade"], "Disponível")
        self.assertEqual(ficha["suporte"], "")
        self.assertEqual(ficha["serie"], "")

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

    def test_work_gallery_images_are_returned_in_order(self):
        category = Category.objects.create(title="Desenho", key="desenho")
        work = Work.objects.create(
            category=category,
            title="Gaiola",
            image_url="/gaiola.jpg",
        )
        WorkImage.objects.create(work=work, image="obras/2026/09/detalhe.webp", position=1)
        WorkImage.objects.create(work=work, image="obras/2026/09/processo.webp", position=0)

        response = self.client.get(reverse("portfolio-data"))

        self.assertEqual(
            response.json()["categorias"][0]["obras"][0]["imagens"],
            [
                "/static/gaiola.jpg",
                "/media/obras/2026/09/processo.webp",
                "/media/obras/2026/09/detalhe.webp",
            ],
        )

    def test_video_only_work_returns_a_youtube_media_card(self):
        category = Category.objects.create(title="Vídeo", key="video")
        work = Work.objects.create(category=category, title="Movimento")
        WorkVideo.objects.create(
            work=work,
            youtube_url="https://youtu.be/AbCdEf01234",
            video_id="AbCdEf01234",
            video_title="Movimento em argila",
            thumbnail_url="https://i.ytimg.com/vi/AbCdEf01234/hqdefault.jpg",
        )

        response = self.client.get(reverse("portfolio-data"))
        portfolio_work = response.json()["categorias"][0]["obras"][0]

        self.assertEqual(portfolio_work["imagem"], "")
        self.assertEqual(portfolio_work["imagens"], [])
        self.assertEqual(portfolio_work["midias"], [{
            "tipo": "youtube",
            "videoId": "AbCdEf01234",
            "titulo": "Movimento em argila",
            "miniatura": "https://i.ytimg.com/vi/AbCdEf01234/hqdefault.jpg",
        }])

    def test_work_media_combines_images_and_youtube_videos_in_order(self):
        category = Category.objects.create(title="Vídeo", key="video")
        work = Work.objects.create(
            category=category,
            title="Processo",
            image_url="/capa.jpg",
        )
        WorkImage.objects.create(
            work=work,
            image="obras/detalhe.webp",
            position=1,
        )
        WorkVideo.objects.create(
            work=work,
            youtube_url="https://youtu.be/AbCdEf01234",
            video_id="AbCdEf01234",
            video_title="Processo em vídeo",
            thumbnail_url="https://i.ytimg.com/vi/AbCdEf01234/hqdefault.jpg",
            position=0,
        )

        response = self.client.get(reverse("portfolio-data"))

        self.assertEqual(
            response.json()["categorias"][0]["obras"][0]["midias"],
            [
                {"tipo": "imagem", "src": "/static/capa.jpg"},
                {
                    "tipo": "youtube",
                    "videoId": "AbCdEf01234",
                    "titulo": "Processo em vídeo",
                    "miniatura": "https://i.ytimg.com/vi/AbCdEf01234/hqdefault.jpg",
                },
                {"tipo": "imagem", "src": "/media/obras/detalhe.webp"},
            ],
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

    def test_admin_video_form_fetches_youtube_metadata(self):
        category = Category.objects.create(title="Vídeo", key="video")
        work = Work.objects.create(category=category, title="Movimento")
        admin_user = get_user_model().objects.create_superuser(
            username="video-admin",
            email="admin@example.com",
            password="test-password",
        )
        self.client.force_login(admin_user)

        metadata = {
            "video_id": "AbCdEf01234",
            "title": "Movimento no YouTube",
            "thumbnail_url": "https://i.ytimg.com/vi/AbCdEf01234/hqdefault.jpg",
        }
        with patch("portfolio.admin.fetch_youtube_video_metadata", return_value=metadata):
            response = self.client.post(
                reverse("admin:portfolio_workvideo_add"),
                {
                    "work": work.pk,
                    "youtube_url": "https://youtu.be/AbCdEf01234",
                    "position": 0,
                },
            )

        self.assertEqual(response.status_code, 302)
        video = WorkVideo.objects.get(work=work)
        self.assertEqual(video.video_id, metadata["video_id"])
        self.assertEqual(video.video_title, metadata["title"])
        self.assertEqual(video.thumbnail_url, metadata["thumbnail_url"])

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

    @override_settings(DEBUG=True)
    def test_debug_nested_frontend_route_is_preserved_for_vite(self):
        response = self.client.get("/painel/")

        self.assertRedirects(
            response,
            "http://127.0.0.1:5173/painel/",
            fetch_redirect_response=False,
        )


class PortfolioSeedTests(TestCase):
    def test_seed_keeps_categories_and_uses_editable_placeholders(self):
        categories = list(Category.objects.order_by("position"))

        self.assertEqual(
            [(category.title, category.key) for category in categories],
            [
                ("Cerâmica", "ceramica"),
                ("Glitch Art", "glitch"),
                ("Gravura", "escultura"),
                ("Desenho", "desenho"),
            ],
        )
        for category in categories:
            works = list(category.works.all())
            self.assertEqual(len(works), 1)
            self.assertEqual(works[0].title, "Obra de exemplo")
            self.assertIn("Lorem ipsum", works[0].description)
            self.assertFalse(works[0].image)
            self.assertFalse(works[0].image_url)

        self.assertFalse(Reference.objects.exists())
        profile = ArtistProfile.objects.get(pk=1)
        self.assertEqual(profile.name, "Nome da artista")
        self.assertFalse(profile.photo)
        self.assertFalse(BackgroundFrame.objects.exists())


class SetupAdminCommandTests(TestCase):
    def test_creates_admin_from_environment(self):
        with patch.dict(os.environ, {
            "DJANGO_SUPERUSER_USERNAME": "bootstrap-admin",
            "DJANGO_SUPERUSER_PASSWORD": "bootstrap-password",
        }, clear=False):
            call_command("setup_admin")

        admin_user = get_user_model().objects.get(username="bootstrap-admin")
        self.assertTrue(admin_user.is_superuser)
        self.assertTrue(admin_user.check_password("bootstrap-password"))

    def test_existing_admin_password_is_not_reset(self):
        admin_user = get_user_model().objects.create_superuser(
            username="bootstrap-admin",
            email="",
            password="original-password",
        )

        with patch.dict(os.environ, {
            "DJANGO_SUPERUSER_USERNAME": "bootstrap-admin",
            "DJANGO_SUPERUSER_PASSWORD": "different-password",
        }, clear=False):
            call_command("setup_admin")

        admin_user.refresh_from_db()
        self.assertTrue(admin_user.check_password("original-password"))


class YouTubeIntegrationTests(TestCase):
    def test_extracts_video_ids_from_youtube_links(self):
        self.assertEqual(
            extract_youtube_video_id("https://www.youtube.com/watch?v=AbCdEf01234"),
            "AbCdEf01234",
        )
        self.assertEqual(
            extract_youtube_video_id("https://youtu.be/AbCdEf01234"),
            "AbCdEf01234",
        )

    def test_rejects_non_youtube_links(self):
        with self.assertRaises(YouTubeMetadataError):
            extract_youtube_video_id("https://example.com/video")

    @override_settings(YOUTUBE_API_KEY="test-api-key")
    def test_fetches_unlisted_video_metadata(self):
        response = MagicMock()
        response.__enter__.return_value.read.return_value = json.dumps({
            "items": [{
                "status": {"embeddable": True, "privacyStatus": "unlisted"},
                "snippet": {
                    "title": "Processo artístico",
                    "thumbnails": {
                        "high": {"url": "https://i.ytimg.com/vi/AbCdEf01234/hqdefault.jpg"},
                    },
                },
            }],
        }).encode()

        with patch("portfolio.youtube.urlopen", return_value=response) as urlopen:
            metadata = fetch_youtube_video_metadata(
                "https://youtu.be/AbCdEf01234"
            )

        self.assertEqual(metadata, {
            "video_id": "AbCdEf01234",
            "title": "Processo artístico",
            "thumbnail_url": "https://i.ytimg.com/vi/AbCdEf01234/hqdefault.jpg",
        })
        self.assertIn("test-api-key", urlopen.call_args.args[0].full_url)

class AdminDashboardTests(TestCase):
    def test_dashboard_shows_live_content_counts_and_quick_actions(self):
        Category.objects.all().delete()
        admin_user = get_user_model().objects.create_superuser(
            username="dashboard-admin",
            email="admin@example.com",
            password="test-password-123",
        )
        category = Category.objects.create(title="Cerâmica teste", key="dashboard-test")
        Work.objects.create(category=category, title="Obra publicada", is_active=True)
        Work.objects.create(category=category, title="Rascunho", is_active=False)
        WorkVideo.objects.create(
            work=Work.objects.first(),
            youtube_url="https://youtu.be/AbCdEf01234",
            video_id="AbCdEf01234",
            video_title="Vídeo de processo",
            thumbnail_url="https://i.ytimg.com/vi/AbCdEf01234/hqdefault.jpg",
        )
        self.client.force_login(admin_user)

        response = self.client.get(reverse("admin:index"))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Obras publicadas")
        self.assertContains(response, "Adicionar uma obra")
        self.assertContains(response, "Visualizar site")
        self.assertContains(response, "2")


class EditorGroupCommandTests(TestCase):
    def test_editor_group_has_edit_permissions_without_delete(self):
        call_command("setup_editor_group")

        group = Group.objects.get(name="Editores do portfólio")
        permissions = set(group.permissions.values_list("codename", flat=True))
        self.assertIn("add_work", permissions)
        self.assertIn("change_work", permissions)
        self.assertIn("view_work", permissions)
        self.assertNotIn("delete_work", permissions)

    def test_editor_group_command_is_idempotent(self):
        call_command("setup_editor_group")
        call_command("setup_editor_group")

        self.assertEqual(Group.objects.filter(name="Editores do portfólio").count(), 1)



class EditorialWorkflowTests(TestCase):
    def setUp(self):
        Category.objects.all().delete()
        self.admin_user = get_user_model().objects.create_superuser(
            username="editorial-admin",
            email="admin@example.com",
            password="test-password-123",
        )
        self.category = Category.objects.create(title="Categoria de teste", key="workflow-test")
        self.work = Work.objects.create(
            category=self.category,
            title="Obra em revisão",
            is_active=False,
        )

    def test_new_work_form_starts_as_draft(self):
        from portfolio.admin import WorkAdminForm

        form = WorkAdminForm()
        self.assertFalse(form.fields["is_active"].initial)

    def test_staff_can_generate_preview_for_unpublished_work(self):
        self.client.force_login(self.admin_user)
        response = self.client.get(
            reverse("admin:portfolio_work_preview", args=[self.work.pk])
        )

        self.assertEqual(response.status_code, 302)
        self.assertIn("preview_token=", response.url)
        token = response.url.split("preview_token=", 1)[1]
        api_response = self.client.get(
            reverse("portfolio-data"),
            {"preview_token": token},
        )

        self.assertEqual(api_response.status_code, 200)
        payload = api_response.json()
        self.assertEqual(payload["preview"]["id"], self.work.pk)
        self.assertEqual(payload["categorias"][0]["obras"][0]["titulo"], "Obra em revisão")

    def test_public_api_hides_categories_without_published_works(self):
        Category.objects.create(title="Categoria vazia", key="categoria-vazia")
        response = self.client.get(reverse("portfolio-data"))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["categorias"], [])

    def test_preview_keeps_category_visible_for_its_draft(self):
        self.client.force_login(self.admin_user)
        preview_response = self.client.get(
            reverse("admin:portfolio_work_preview", args=[self.work.pk])
        )
        token = preview_response.url.split("preview_token=", 1)[1]

        response = self.client.get(reverse("portfolio-data"), {"preview_token": token})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()["categorias"]), 1)
        self.assertEqual(response.json()["categorias"][0]["obras"][0]["titulo"], "Obra em revisão")

    def test_anonymous_user_cannot_use_preview_token(self):
        self.client.force_login(self.admin_user)
        preview_response = self.client.get(
            reverse("admin:portfolio_work_preview", args=[self.work.pk])
        )
        token = preview_response.url.split("preview_token=", 1)[1]
        self.client.logout()

        response = self.client.get(reverse("portfolio-data"), {"preview_token": token})

        self.assertEqual(response.status_code, 403)


class SocialPreviewMetadataTests(TestCase):
    def setUp(self):
        ArtistProfile.objects.all().delete()

    def test_homepage_uses_selected_published_work_for_social_preview(self):
        category = Category.objects.create(title="Videoarte", key="videoarte")
        Work.objects.create(
            category=category,
            title="Ciclos",
            image_url="https://res.cloudinary.com/demo/image/upload/ciclos.jpg",
            description="Uma experiência audiovisual sobre ciclos.",
            is_active=True,
            is_share_image=True,
        )
        ArtistProfile.objects.create(name="Luli Becker", bio="Artista visual.")

        with TemporaryDirectory() as directory:
            Path(directory, "index.html").write_text(
                '<!doctype html><html><head><title>Portfólio</title></head><body></body></html>',
                encoding="utf-8",
            )
            with override_settings(DEBUG=False, FRONTEND_DIST=Path(directory)):
                response = frontend(RequestFactory().get("/"))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, '<meta property="og:title" content="Luli Becker" />')
        self.assertContains(response, '<meta property="og:description" content="Portfólio digital" />')
        self.assertNotContains(response, "Ciclos | Luli Becker")
        self.assertNotContains(response, "Uma experiência audiovisual sobre ciclos.")
        self.assertContains(response, "https://res.cloudinary.com/demo/image/upload/ciclos.jpg")
        self.assertContains(response, '<meta name="twitter:card" content="summary_large_image" />')

    def test_homepage_falls_back_to_artist_profile_without_selected_work(self):
        ArtistProfile.objects.create(
            name="Luli Becker",
            tagline="Artista visual e pesquisadora.",
            bio="Biografia.",
        )
        with TemporaryDirectory() as directory:
            Path(directory, "index.html").write_text(
                '<!doctype html><html><head><title>Portfólio</title></head><body></body></html>',
                encoding="utf-8",
            )
            with override_settings(DEBUG=False, FRONTEND_DIST=Path(directory)):
                response = frontend(RequestFactory().get("/"))

        self.assertContains(response, '<meta property="og:title" content="Luli Becker" />')
        self.assertContains(response, '<meta property="og:description" content="Portfólio digital" />')
        self.assertNotContains(response, "Artista visual e pesquisadora.")
        self.assertNotContains(response, 'property="og:image"')



class CmsReadApiTests(TestCase):
    def setUp(self):
        # The initial migrations seed sample portfolio data; isolate these tests.
        Work.objects.all().delete()
        Category.objects.all().delete()
        Reference.objects.all().delete()
        self.category = Category.objects.create(
            title="Cerâmica", key="cms-ceramica", position=1
        )
        self.published = Work.objects.create(
            category=self.category,
            title="Vaso azul",
            description="Peça em cerâmica",
            is_active=True,
            image_url="https://example.com/vaso.jpg",
        )
        self.draft = Work.objects.create(
            category=self.category,
            title="Estudo em argila",
            is_active=False,
        )
        WorkImage.objects.create(
            work=self.published, image="obras/detalhe.webp", position=0
        )
        WorkVideo.objects.create(
            work=self.published,
            youtube_url="https://youtu.be/AbCdEf01234",
            video_id="AbCdEf01234",
            video_title="Processo",
            thumbnail_url="https://i.ytimg.com/vi/AbCdEf01234/hqdefault.jpg",
        )

    def test_anonymous_users_receive_json_401(self):
        response = self.client.get(reverse("cms-works"))

        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json(), {"error": "authentication_required"})

    def test_authenticated_non_staff_users_receive_json_403(self):
        user = get_user_model().objects.create_user(
            username="regular-user", password="test-password-123"
        )
        self.client.force_login(user)

        response = self.client.get(reverse("cms-works"))

        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json(), {"error": "staff_required"})

    def test_staff_can_read_overview_without_exposing_credentials(self):
        staff = get_user_model().objects.create_user(
            username="cms-staff", password="test-password-123", is_staff=True
        )
        self.client.force_login(staff)

        response = self.client.get(reverse("cms-overview"))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {
            "works": {"total": 2, "published": 1, "drafts": 1},
            "categories": 1,
            "categoryOptions": [{"id": self.category.pk, "key": "cms-ceramica", "title": "Cerâmica"}],
            "references": 0,
            "videos": 1,
            "permissions": {"canCreateWork": False, "canEditWork": False},
        })
        self.assertEqual(response["Cache-Control"], "max-age=0, no-cache, no-store, must-revalidate, private")

    def test_library_defaults_to_all_works_and_returns_editorial_metadata(self):
        staff = get_user_model().objects.create_user(
            username="cms-library", password="test-password-123", is_staff=True
        )
        self.client.force_login(staff)

        response = self.client.get(reverse("cms-works"))

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["pagination"]["total"], 2)
        self.assertEqual([item["title"] for item in payload["results"]], [
            "Vaso azul", "Estudo em argila"
        ])
        self.assertEqual(payload["results"][0]["category"], {
            "key": "cms-ceramica", "title": "Cerâmica"
        })
        self.assertEqual(payload["results"][0]["media"], {
            "images": 1, "gallery": 1, "videos": 1
        })
        self.assertTrue(payload["results"][0]["published"])
        self.assertFalse(payload["results"][1]["published"])

    def test_library_search_and_status_filters_are_applied_on_server(self):
        staff = get_user_model().objects.create_user(
            username="cms-filter", password="test-password-123", is_staff=True
        )
        self.client.force_login(staff)

        response = self.client.get(
            reverse("cms-works"),
            {"q": "argila", "status": "draft", "category": "cms-ceramica"},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual([item["title"] for item in response.json()["results"]], [
            "Estudo em argila"
        ])
        self.assertEqual(response.json()["pagination"]["total"], 1)

    def test_library_caps_page_size_and_rejects_invalid_pagination(self):
        staff = get_user_model().objects.create_user(
            username="cms-pagination", password="test-password-123", is_staff=True
        )
        self.client.force_login(staff)

        capped = self.client.get(reverse("cms-works"), {"limit": 500})
        invalid = self.client.get(reverse("cms-works"), {"offset": "-1"})
        invalid_status = self.client.get(reverse("cms-works"), {"status": "everything"})

        self.assertEqual(capped.status_code, 200)
        self.assertEqual(capped.json()["pagination"]["limit"], 50)
        self.assertEqual(invalid.status_code, 400)
        self.assertEqual(invalid.json(), {"error": "invalid_pagination"})
        self.assertEqual(invalid_status.status_code, 400)
        self.assertEqual(invalid_status.json(), {"error": "invalid_status"})


class CmsWorkUpdateApiTests(TestCase):
    def setUp(self):
        from django.contrib.auth.models import Permission

        Work.objects.all().delete()
        Category.objects.all().delete()
        self.category = Category.objects.create(title="Pintura", key="pintura")
        self.other_category = Category.objects.create(title="Desenho", key="desenho")
        self.work = Work.objects.create(
            category=self.category,
            title="Estudo inicial",
            description="Descrição original",
            technique="Acrílica",
            year=2024,
            is_active=False,
        )
        self.editor = get_user_model().objects.create_user(
            username="cms-work-editor",
            password="test-password-123",
            is_staff=True,
        )
        self.editor.user_permissions.add(
            Permission.objects.get(
                content_type__app_label="portfolio",
                codename="change_work",
            )
        )

    def patch_work(self, payload, client=None, work_id=None, **extra):
        client = client or self.client
        return client.patch(
            reverse("cms-work-update", args=[work_id or self.work.pk]),
            data=json.dumps(payload),
            content_type="application/json",
            **extra,
        )

    def test_anonymous_user_cannot_update_work(self):
        response = self.patch_work({"title": "Alteração indevida"})

        self.assertEqual(response.status_code, 401)
        self.work.refresh_from_db()
        self.assertEqual(self.work.title, "Estudo inicial")

    def test_staff_without_change_permission_cannot_update_work(self):
        staff = get_user_model().objects.create_user(
            username="cms-read-only-staff",
            password="test-password-123",
            is_staff=True,
        )
        self.client.force_login(staff)

        response = self.patch_work({"title": "Alteração indevida"})

        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json()["error"], "work_edit_permission_required")
        self.work.refresh_from_db()
        self.assertEqual(self.work.title, "Estudo inicial")

    def test_editor_can_partially_update_metadata_without_changing_other_fields(self):
        self.client.force_login(self.editor)

        response = self.patch_work({
            "title": "Obra revisada",
            "category": self.other_category.pk,
            "description": "Nova descrição",
        })

        self.assertEqual(response.status_code, 200)
        self.work.refresh_from_db()
        self.assertEqual(self.work.title, "Obra revisada")
        self.assertEqual(self.work.category, self.other_category)
        self.assertEqual(self.work.description, "Nova descrição")
        self.assertEqual(self.work.technique, "Acrílica")
        self.assertEqual(self.work.year, 2024)
        self.assertFalse(self.work.is_active)
        self.assertEqual(response.json()["category"]["key"], "desenho")

    def test_editor_cannot_change_publication_or_media_through_metadata_endpoint(self):
        self.client.force_login(self.editor)

        response = self.patch_work({
            "title": "Título alterado",
            "is_active": True,
            "image_url": "https://example.com/unsafe.jpg",
        })

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["error"], "unknown_fields")
        self.work.refresh_from_db()
        self.assertEqual(self.work.title, "Estudo inicial")
        self.assertFalse(self.work.is_active)

    def test_invalid_values_are_rejected_without_partial_save(self):
        self.client.force_login(self.editor)

        response = self.patch_work({
            "title": "Título que não deve salvar",
            "year": "não é um ano",
        })

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["error"], "validation_error")
        self.work.refresh_from_db()
        self.assertEqual(self.work.title, "Estudo inicial")

    def test_invalid_json_and_wrong_content_type_are_rejected(self):
        self.client.force_login(self.editor)

        malformed = self.client.patch(
            reverse("cms-work-update", args=[self.work.pk]),
            data="{",
            content_type="application/json",
        )
        wrong_type = self.client.patch(
            reverse("cms-work-update", args=[self.work.pk]),
            data="title=Outra",
            content_type="application/x-www-form-urlencoded",
        )

        self.assertEqual(malformed.status_code, 400)
        self.assertEqual(malformed.json()["error"], "invalid_json")
        self.assertEqual(wrong_type.status_code, 415)
        self.assertEqual(wrong_type.json()["error"], "application_json_required")

    def test_csrf_is_required_for_authenticated_editor(self):
        csrf_client = Client(enforce_csrf_checks=True)
        login_page = csrf_client.get(reverse("admin:login"))
        token = login_page.cookies["csrftoken"].value
        csrf_client.force_login(self.editor)

        rejected = csrf_client.patch(
            reverse("cms-work-update", args=[self.work.pk]),
            data=json.dumps({"title": "Sem token"}),
            content_type="application/json",
        )
        self.assertEqual(rejected.status_code, 403)

        accepted = csrf_client.patch(
            reverse("cms-work-update", args=[self.work.pk]),
            data=json.dumps({"title": "Com token"}),
            content_type="application/json",
            HTTP_X_CSRFTOKEN=token,
        )

        self.assertEqual(accepted.status_code, 200)
        self.work.refresh_from_db()
        self.assertEqual(self.work.title, "Com token")

    def test_unknown_work_returns_404(self):
        self.client.force_login(self.editor)

        response = self.patch_work({"title": "Não existe"}, work_id=999999)

        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json()["error"], "work_not_found")


class CmsWorkDetailApiTests(TestCase):
    def setUp(self):
        Work.objects.all().delete()
        Category.objects.all().delete()
        self.category = Category.objects.create(title="Pintura", key="pintura")
        self.work = Work.objects.create(
            category=self.category,
            title="Estudo inicial",
            description="Descrição original",
            technique="Acrílica",
            year=2024,
            height="12.50",
            price="250.00",
            signed=None,
            is_active=False,
        )
        self.staff = get_user_model().objects.create_user(
            username="cms-work-detail-staff",
            password="test-password-123",
            is_staff=True,
        )

    def test_staff_can_read_work_detail_and_receive_csrf_cookie(self):
        self.client.force_login(self.staff)

        response = self.client.get(reverse("cms-work-update", args=[self.work.pk]))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["title"], "Estudo inicial")
        self.assertEqual(response.json()["image"], "")
        self.assertEqual(response.json()["category"], self.category.pk)
        self.assertEqual(response.json()["height"], "12.50")
        self.assertEqual(response.json()["price"], "250.00")
        self.assertIsNone(response.json()["signed"])
        self.assertIn("csrftoken", response.cookies)

    def test_anonymous_user_cannot_read_work_detail(self):
        response = self.client.get(reverse("cms-work-update", args=[self.work.pk]))

        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json()["error"], "authentication_required")

    def test_staff_without_change_permission_can_read_but_not_update(self):
        self.client.force_login(self.staff)

        read_response = self.client.get(reverse("cms-work-update", args=[self.work.pk]))
        update_response = self.client.patch(
            reverse("cms-work-update", args=[self.work.pk]),
            data=json.dumps({"title": "Não autorizado"}),
            content_type="application/json",
        )

        self.assertEqual(read_response.status_code, 200)
        self.assertEqual(update_response.status_code, 403)
        self.assertEqual(update_response.json()["error"], "work_edit_permission_required")
        self.work.refresh_from_db()
        self.assertEqual(self.work.title, "Estudo inicial")


class CmsWorkCreateApiTests(TestCase):
    def setUp(self):
        from django.contrib.auth.models import Permission

        Work.objects.all().delete()
        Category.objects.all().delete()
        self.category = Category.objects.create(title="Pintura", key="pintura")
        self.staff = get_user_model().objects.create_user(
            username="cms-work-creator",
            password="test-password-123",
            is_staff=True,
        )
        self.add_permission = Permission.objects.get(
            content_type__app_label="portfolio",
            codename="add_work",
        )
        self.change_permission = Permission.objects.get(
            content_type__app_label="portfolio",
            codename="change_work",
        )

    def post_work(self, payload, client=None):
        client = client or self.client
        return client.post(
            reverse("cms-work-create"),
            data=json.dumps(payload),
            content_type="application/json",
        )

    def test_anonymous_user_cannot_create_work(self):
        response = self.post_work({"title": "Obra nova", "category": self.category.pk})

        self.assertEqual(response.status_code, 401)
        self.assertEqual(Work.objects.count(), 0)

    def test_staff_without_add_permission_cannot_create_work(self):
        self.client.force_login(self.staff)

        response = self.post_work({"title": "Obra nova", "category": self.category.pk})

        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json()["error"], "work_create_permission_required")
        self.assertEqual(Work.objects.count(), 0)

    def test_authorized_editor_creates_new_work_as_draft(self):
        self.staff.user_permissions.add(self.add_permission, self.change_permission)
        self.client.force_login(self.staff)

        response = self.post_work({
            "title": "Obra em preparação",
            "category": self.category.pk,
            "description": "Ainda em edição",
            "technique": "Acrílica",
            "position": 3,
        })

        self.assertEqual(response.status_code, 201)
        work = Work.objects.get(pk=response.json()["id"])
        self.assertEqual(work.title, "Obra em preparação")
        self.assertEqual(work.description, "Ainda em edição")
        self.assertFalse(work.is_active)
        self.assertFalse(work.is_share_image)
        self.assertEqual(response.json()["published"], False)

    def test_create_endpoint_requires_csrf_for_authenticated_editor(self):
        self.staff.user_permissions.add(self.add_permission)
        csrf_client = Client(enforce_csrf_checks=True)
        csrf_client.force_login(self.staff)
        overview = csrf_client.get(reverse("cms-overview"))
        token = overview.cookies["csrftoken"].value
        payload = {
            "title": "Obra protegida por CSRF",
            "category": self.category.pk,
            "position": 0,
        }

        rejected = csrf_client.post(
            reverse("cms-work-create"),
            data=json.dumps(payload),
            content_type="application/json",
        )
        accepted = csrf_client.post(
            reverse("cms-work-create"),
            data=json.dumps(payload),
            content_type="application/json",
            HTTP_X_CSRFTOKEN=token,
        )

        self.assertEqual(rejected.status_code, 403)
        self.assertEqual(accepted.status_code, 201)
        self.assertEqual(Work.objects.count(), 1)

    def test_create_endpoint_rejects_publication_and_media_fields(self):
        self.staff.user_permissions.add(self.add_permission)
        self.client.force_login(self.staff)

        response = self.post_work({
            "title": "Não deve ser criada",
            "category": self.category.pk,
            "is_active": True,
            "image_url": "https://example.com/image.jpg",
        })

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["error"], "unknown_fields")
        self.assertEqual(Work.objects.count(), 0)

    def test_invalid_required_fields_are_rejected_without_creating_work(self):
        self.staff.user_permissions.add(self.add_permission)
        self.client.force_login(self.staff)

        response = self.post_work({
            "title": "",
            "category": self.category.pk,
            "year": "não é um ano",
        })

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["error"], "validation_error")
        self.assertEqual(Work.objects.count(), 0)



class CmsWorkCoverUploadApiTests(TestCase):
    def setUp(self):
        from django.contrib.auth.models import Permission

        self.media_dir = TemporaryDirectory()
        self.addCleanup(self.media_dir.cleanup)
        media_settings = override_settings(MEDIA_ROOT=self.media_dir.name)
        media_settings.enable()
        self.addCleanup(media_settings.disable)
        Work.objects.all().delete()
        Category.objects.all().delete()
        self.category = Category.objects.create(title="Pintura", key="capa-pintura")
        self.work = Work.objects.create(
            category=self.category,
            title="Obra com capa",
            image_url="https://example.com/legacy-cover.jpg",
        )
        self.editor = get_user_model().objects.create_user(
            username="cms-cover-editor",
            password="test-password-123",
            is_staff=True,
        )
        self.editor.user_permissions.add(Permission.objects.get(
            content_type__app_label="portfolio",
            codename="change_work",
        ))

    def make_image(self, image_format="PNG", name="cover.png", size=(32, 24)):
        content = BytesIO()
        Image.new("RGB", size, "navy").save(content, format=image_format)
        return SimpleUploadedFile(
            name,
            content.getvalue(),
            content_type="image/png",
        )

    def upload(self, file, client=None):
        client = client or self.client
        return client.post(
            reverse("cms-work-cover-upload", args=[self.work.pk]),
            {"image": file},
        )

    def test_anonymous_user_cannot_upload_cover(self):
        response = self.upload(self.make_image())

        self.assertEqual(response.status_code, 401)
        self.work.refresh_from_db()
        self.assertFalse(self.work.image)
        self.assertEqual(self.work.image_url, "https://example.com/legacy-cover.jpg")

    def test_staff_without_change_permission_cannot_upload_cover(self):
        staff = get_user_model().objects.create_user(
            username="cms-cover-readonly",
            password="test-password-123",
            is_staff=True,
        )
        self.client.force_login(staff)

        response = self.upload(self.make_image())

        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json()["error"], "work_edit_permission_required")

    def test_editor_can_upload_real_image_and_clear_legacy_url(self):
        self.client.force_login(self.editor)

        response = self.upload(self.make_image())

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["image"])
        self.work.refresh_from_db()
        self.assertTrue(self.work.image.name.endswith(".png"))
        self.assertEqual(self.work.image_url, "")

    def test_non_image_content_is_rejected_without_replacing_existing_cover(self):
        self.client.force_login(self.editor)
        self.work.image_url = "https://example.com/keep-this.jpg"
        self.work.save(update_fields=["image_url"])
        fake = SimpleUploadedFile("fake.png", b"not an image", content_type="image/png")

        response = self.upload(fake)

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["error"], "invalid_image_file")
        self.work.refresh_from_db()
        self.assertFalse(self.work.image)
        self.assertEqual(self.work.image_url, "https://example.com/keep-this.jpg")

    def test_unsupported_image_format_is_rejected(self):
        self.client.force_login(self.editor)

        response = self.upload(self.make_image("GIF", "cover.gif"))

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["error"], "unsupported_image_format")

    def test_upload_requires_csrf(self):
        csrf_client = Client(enforce_csrf_checks=True)
        csrf_client.force_login(self.editor)
        token_response = csrf_client.get(reverse("cms-overview"))
        token = token_response.cookies["csrftoken"].value

        rejected = csrf_client.post(
            reverse("cms-work-cover-upload", args=[self.work.pk]),
            {"image": self.make_image()},
        )
        accepted = csrf_client.post(
            reverse("cms-work-cover-upload", args=[self.work.pk]),
            {"image": self.make_image()},
            HTTP_X_CSRFTOKEN=token,
        )

        self.assertEqual(rejected.status_code, 403)
        self.assertEqual(accepted.status_code, 200)

    def test_unknown_work_returns_404(self):
        self.client.force_login(self.editor)

        response = self.client.post(
            reverse("cms-work-cover-upload", args=[999999]),
            {"image": self.make_image()},
        )

        self.assertEqual(response.status_code, 404)


    def test_successful_replacement_removes_old_stored_cover(self):
        self.client.force_login(self.editor)
        self.work.image.save("previous.png", self.make_image(), save=True)
        old_name = self.work.image.name
        old_storage = self.work.image.storage
        self.assertTrue(old_storage.exists(old_name))

        response = self.upload(self.make_image(name="replacement.png"))

        self.assertEqual(response.status_code, 200)
        self.work.refresh_from_db()
        self.assertNotEqual(self.work.image.name, old_name)
        self.assertFalse(old_storage.exists(old_name))
        self.assertTrue(old_storage.exists(self.work.image.name))

    def test_storage_failure_preserves_existing_cover(self):
        self.client.force_login(self.editor)
        self.work.image.save("keep.png", self.make_image(), save=True)
        old_name = self.work.image.name
        old_storage = self.work.image.storage

        with patch("portfolio.cms_api.default_storage.save", side_effect=OSError("storage unavailable")):
            response = self.upload(self.make_image(name="replacement.png"))

        self.assertEqual(response.status_code, 503)
        self.work.refresh_from_db()
        self.assertEqual(self.work.image.name, old_name)
        self.assertTrue(old_storage.exists(old_name))



class CmsWorkGalleryApiTests(TestCase):
    def setUp(self):
        self.media_dir = TemporaryDirectory()
        self.addCleanup(self.media_dir.cleanup)
        media_settings = override_settings(MEDIA_ROOT=self.media_dir.name)
        media_settings.enable()
        self.addCleanup(media_settings.disable)
        category = Category.objects.create(title="Pintura", key="cms-gallery-pintura")
        self.work = Work.objects.create(category=category, title="Obra da galeria")
        from django.contrib.auth.models import Permission
        self.editor = get_user_model().objects.create_user(
            username="cms-gallery-editor", password="test-password-123", is_staff=True
        )
        self.editor.user_permissions.add(Permission.objects.get(
            content_type__app_label="portfolio", codename="change_work"
        ))

    def make_image(self, name="gallery.png", image_format="PNG"):
        content = BytesIO()
        Image.new("RGB", (24, 18), "teal").save(content, format=image_format)
        return SimpleUploadedFile(name, content.getvalue(), content_type="image/png")

    def endpoint(self):
        return reverse("cms-work-gallery", args=[self.work.pk])

    def test_gallery_list_requires_staff(self):
        self.assertEqual(self.client.get(self.endpoint()).status_code, 401)
        regular = get_user_model().objects.create_user(username="gallery-regular")
        self.client.force_login(regular)
        self.assertEqual(self.client.get(self.endpoint()).status_code, 403)

    def test_editor_can_list_upload_reorder_and_delete_gallery_images(self):
        self.client.force_login(self.editor)
        first = self.client.post(self.endpoint(), {"image": self.make_image("first.png")})
        second = self.client.post(self.endpoint(), {"image": self.make_image("second.png")})
        self.assertEqual(first.status_code, 201)
        self.assertEqual(second.status_code, 201)
        first_id, second_id = first.json()["id"], second.json()["id"]

        listing = self.client.get(self.endpoint())
        self.assertEqual([item["id"] for item in listing.json()["results"]], [first_id, second_id])

        reordered = self.client.patch(
            self.endpoint(),
            data=json.dumps({"imageIds": [second_id, first_id]}),
            content_type="application/json",
        )
        self.assertEqual(reordered.status_code, 200)
        self.assertEqual([item["id"] for item in reordered.json()["results"]], [second_id, first_id])
        self.assertEqual(reordered.json()["results"][0]["position"], 0)

        deleted = self.client.post(reverse(
            "cms-work-gallery-delete", args=[self.work.pk, second_id]
        ))
        self.assertEqual(deleted.status_code, 200)
        self.assertEqual(deleted.json(), {"deleted": second_id})
        self.assertEqual(list(self.work.gallery_images.values_list("pk", flat=True)), [first_id])

    def test_upload_rejects_fake_files_and_oversized_images(self):
        self.client.force_login(self.editor)
        fake = SimpleUploadedFile("fake.png", b"not an image", content_type="image/png")
        response = self.client.post(self.endpoint(), {"image": fake})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["error"], "invalid_image_file")
        self.assertEqual(self.work.gallery_images.count(), 0)

        oversized = SimpleUploadedFile("large.png", b"x" * (15 * 1024 * 1024 + 1), content_type="image/png")
        response = self.client.post(self.endpoint(), {"image": oversized})
        self.assertEqual(response.status_code, 413)
        self.assertEqual(response.json()["error"], "image_too_large")

    def test_reorder_must_include_exact_owned_image_ids(self):
        self.client.force_login(self.editor)
        image = self.client.post(self.endpoint(), {"image": self.make_image()}).json()
        response = self.client.patch(
            self.endpoint(),
            data=json.dumps({"imageIds": [image["id"], 999999]}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["error"], "image_order_mismatch")

    def test_user_without_change_permission_cannot_mutate_gallery(self):
        staff = get_user_model().objects.create_user(
            username="gallery-readonly", is_staff=True
        )
        self.client.force_login(staff)
        response = self.client.post(self.endpoint(), {"image": self.make_image()})
        self.assertEqual(response.status_code, 403)

    def test_gallery_mutations_require_csrf(self):
        client = Client(enforce_csrf_checks=True)
        client.force_login(self.editor)
        rejected = client.post(self.endpoint(), {"image": self.make_image()})
        self.assertEqual(rejected.status_code, 403)
        token_response = client.get(self.endpoint())
        token = token_response.cookies["csrftoken"].value
        accepted = client.post(
            self.endpoint(), {"image": self.make_image()},
            HTTP_X_CSRFTOKEN=token,
        )
        self.assertEqual(accepted.status_code, 201)

    def test_cannot_delete_an_image_from_another_work(self):
        self.client.force_login(self.editor)
        other = Work.objects.create(category=self.work.category, title="Outra obra")
        image = WorkImage.objects.create(work=other, image="obras/outro.webp")
        response = self.client.post(reverse(
            "cms-work-gallery-delete", args=[self.work.pk, image.pk]
        ))
        self.assertEqual(response.status_code, 404)
        self.assertTrue(WorkImage.objects.filter(pk=image.pk).exists())



class CmsWorkVideoApiTests(TestCase):
    def setUp(self):
        category = Category.objects.create(title="Vídeo", key="cms-video")
        self.work = Work.objects.create(category=category, title="Obra com vídeo")
        self.editor = get_user_model().objects.create_user(
            username="cms-video-editor", password="test-password-123", is_staff=True
        )
        from django.contrib.auth.models import Permission
        self.editor.user_permissions.add(Permission.objects.get(
            content_type__app_label="portfolio", codename="change_work"
        ))
        self.metadata = {
            "video_id": "AbCdEf01234",
            "title": "Processo artístico",
            "thumbnail_url": "https://i.ytimg.com/vi/AbCdEf01234/hqdefault.jpg",
        }

    def endpoint(self):
        return reverse("cms-work-videos", args=[self.work.pk])

    def add_video(self, url="https://youtu.be/AbCdEf01234", metadata=None):
        with patch("portfolio.cms_api.fetch_youtube_video_metadata", return_value=metadata or self.metadata):
            return self.client.post(
                self.endpoint(),
                data=json.dumps({"youtubeUrl": url}),
                content_type="application/json",
            )

    def test_video_list_requires_staff(self):
        self.assertEqual(self.client.get(self.endpoint()).status_code, 401)
        regular = get_user_model().objects.create_user(username="cms-video-regular")
        self.client.force_login(regular)
        self.assertEqual(self.client.get(self.endpoint()).status_code, 403)

    def test_editor_can_add_list_reorder_and_delete_videos(self):
        self.client.force_login(self.editor)
        first = self.add_video()
        self.assertEqual(first.status_code, 201)
        second_metadata = {**self.metadata, "video_id": "ZyXwVu98765", "title": "Making of"}
        second = self.add_video("https://www.youtube.com/watch?v=ZyXwVu98765", second_metadata)
        self.assertEqual(second.status_code, 201)
        first_id, second_id = first.json()["id"], second.json()["id"]

        listing = self.client.get(self.endpoint())
        self.assertEqual([item["id"] for item in listing.json()["results"]], [first_id, second_id])
        self.assertEqual(listing.json()["results"][0]["title"], "Processo artístico")

        reordered = self.client.patch(
            self.endpoint(),
            data=json.dumps({"videoIds": [second_id, first_id]}),
            content_type="application/json",
        )
        self.assertEqual(reordered.status_code, 200)
        self.assertEqual([item["id"] for item in reordered.json()["results"]], [second_id, first_id])

        deleted = self.client.post(reverse(
            "cms-work-video-delete", args=[self.work.pk, second_id]
        ))
        self.assertEqual(deleted.status_code, 200)
        self.assertFalse(WorkVideo.objects.filter(pk=second_id).exists())

    def test_video_metadata_validation_and_duplicate_protection(self):
        self.client.force_login(self.editor)
        with patch("portfolio.cms_api.fetch_youtube_video_metadata", side_effect=YouTubeMetadataError("Link inválido.")):
            invalid = self.client.post(self.endpoint(), data=json.dumps({"youtubeUrl": "https://example.com"}), content_type="application/json")
        self.assertEqual(invalid.status_code, 400)
        self.assertEqual(invalid.json()["error"], "youtube_metadata_error")

        self.assertEqual(self.add_video().status_code, 201)
        duplicate = self.add_video()
        self.assertEqual(duplicate.status_code, 409)
        self.assertEqual(WorkVideo.objects.filter(work=self.work).count(), 1)

    def test_video_reordering_requires_exact_owned_ids(self):
        self.client.force_login(self.editor)
        video = self.add_video().json()
        response = self.client.patch(
            self.endpoint(),
            data=json.dumps({"videoIds": [video["id"], 999999]}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["error"], "video_order_mismatch")

    def test_user_without_change_permission_cannot_mutate_videos(self):
        staff = get_user_model().objects.create_user(username="cms-video-readonly", is_staff=True)
        self.client.force_login(staff)
        response = self.add_video()
        self.assertEqual(response.status_code, 403)

    def test_video_mutations_require_csrf(self):
        client = Client(enforce_csrf_checks=True)
        client.force_login(self.editor)
        rejected = client.post(
            self.endpoint(),
            data=json.dumps({"youtubeUrl": "https://youtu.be/AbCdEf01234"}),
            content_type="application/json",
        )
        self.assertEqual(rejected.status_code, 403)
        token = client.get(self.endpoint()).cookies["csrftoken"].value
        with patch("portfolio.cms_api.fetch_youtube_video_metadata", return_value=self.metadata):
            accepted = client.post(
                self.endpoint(),
                data=json.dumps({"youtubeUrl": "https://youtu.be/AbCdEf01234"}),
                content_type="application/json",
                HTTP_X_CSRFTOKEN=token,
            )
        self.assertEqual(accepted.status_code, 201)

    def test_cannot_delete_video_from_another_work(self):
        self.client.force_login(self.editor)
        other = Work.objects.create(category=self.work.category, title="Outra obra")
        video = WorkVideo.objects.create(
            work=other,
            youtube_url="https://youtu.be/AbCdEf01234",
            video_id="AbCdEf01234",
            video_title="Vídeo de outra obra",
            thumbnail_url="https://i.ytimg.com/vi/AbCdEf01234/hqdefault.jpg",
        )
        response = self.client.post(reverse(
            "cms-work-video-delete", args=[self.work.pk, video.pk]
        ))
        self.assertEqual(response.status_code, 404)
        self.assertTrue(WorkVideo.objects.filter(pk=video.pk).exists())
