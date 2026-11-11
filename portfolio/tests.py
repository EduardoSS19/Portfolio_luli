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
            "references": 0,
            "videos": 1,
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
