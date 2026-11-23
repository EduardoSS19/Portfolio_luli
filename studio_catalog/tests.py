from django.test import TestCase
from django.urls import reverse

from .models import StudioTemplate


class PublishedStudioTemplateTests(TestCase):
    def test_public_endpoint_returns_published_templates_in_order(self):
        StudioTemplate.objects.all().delete()
        second = StudioTemplate.objects.create(
            slug="segundo", title="Segundo", description="Descrição", presentation_mode="editorial",
            position=2, is_published=True, tags=["texto"],
        )
        first = StudioTemplate.objects.create(
            slug="primeiro", title="Primeiro", description="Descrição", presentation_mode="masonry",
            position=1, is_published=True,
        )
        StudioTemplate.objects.create(
            slug="rascunho", title="Rascunho", description="Não publicar", presentation_mode="museum",
            position=0, is_published=False,
        )

        response = self.client.get(reverse("studio-published-templates"))

        self.assertEqual(response.status_code, 200)
        self.assertEqual([item["id"] for item in response.json()["results"]], [first.pk, second.pk])
        self.assertEqual(response.json()["results"][0]["tags"], [])

    def test_public_endpoint_is_read_only(self):
        response = self.client.post(reverse("studio-published-templates"), data={})
        self.assertEqual(response.status_code, 405)

    def test_unpublished_catalog_is_empty(self):
        StudioTemplate.objects.all().delete()
        response = self.client.get(reverse("studio-published-templates"))
        self.assertEqual(response.json(), {"results": []})
