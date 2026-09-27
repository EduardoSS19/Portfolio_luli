from django.test import TestCase
from django.urls import reverse

from .models import Category, Reference, Work


class PortfolioApiTests(TestCase):
    def setUp(self):
        Category.objects.all().delete()
        Reference.objects.all().delete()

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

        response = self.client.get(reverse("portfolio-data"))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {
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

        self.assertEqual(response.json(), {"categorias": [], "referencias": []})

    def test_local_image_path_uses_static_prefix(self):
        category = Category.objects.create(title="Desenho", key="desenho")
        Work.objects.create(category=category, title="Gaiola", image_url="/gaiola.jpg")

        response = self.client.get(reverse("portfolio-data"))

        self.assertEqual(
            response.json()["categorias"][0]["obras"][0]["imagem"],
            "/static/gaiola.jpg",
        )

    def test_healthcheck_returns_ok(self):
        response = self.client.get(reverse("healthcheck"))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "ok"})