from django.contrib.auth import get_user_model
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


class StudioTemplateManagementTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(username="studio-editor", password="test-pass")
        self.user.is_staff = True
        self.user.save(update_fields=["is_staff"])
        permissions = ["view_studiotemplate", "add_studiotemplate", "change_studiotemplate", "delete_studiotemplate"]
        from django.contrib.auth.models import Permission
        for codename in permissions:
            self.user.user_permissions.add(Permission.objects.get(content_type__app_label="studio_catalog", codename=codename))
        self.client.force_login(self.user)

    def test_staff_can_create_and_update_template(self):
        payload = {
            "slug": "novo-modelo", "title": "Novo modelo", "kind": "Editorial",
            "description": "Descrição do modelo", "presentation_mode": "editorial",
            "preview_shape": "editorial", "tags": ["texto"], "layout_config": {},
            "position": 0, "is_published": False,
        }
        response = self.client.post(reverse("studio-manage-templates"), data=__import__("json").dumps(payload), content_type="application/json")
        self.assertEqual(response.status_code, 201)
        item_id = response.json()["result"]["id"]
        payload["title"] = "Modelo atualizado"
        response = self.client.patch(reverse("studio-manage-template-detail", args=[item_id]), data=__import__("json").dumps(payload), content_type="application/json")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["result"]["title"], "Modelo atualizado")

    def test_non_staff_cannot_manage_templates(self):
        self.client.logout()
        user = get_user_model().objects.create_user(username="regular-user", password="test-pass")
        self.client.force_login(user)
        response = self.client.get(reverse("studio-manage-templates"))
        self.assertEqual(response.status_code, 403)

    def test_user_without_permission_cannot_manage_templates(self):
        self.user.user_permissions.clear()
        response = self.client.get(reverse("studio-manage-templates"))
        self.assertEqual(response.status_code, 403)
