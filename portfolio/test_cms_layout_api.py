import json

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Permission
from django.test import TestCase
from django.urls import reverse

from .layout_settings import DEFAULT_LAYOUT_SETTINGS
from .models import ArtistProfile


class CmsLayoutApiTests(TestCase):
    def setUp(self):
        self.profile, _ = ArtistProfile.objects.get_or_create(
            pk=1, defaults={"name": "Artista", "bio": "Biografia"}
        )
        self.profile.layout_settings = {}
        self.profile.save(update_fields=["layout_settings"])
        self.staff = get_user_model().objects.create_user(
            username="layout-editor", password="test-password-123", is_staff=True
        )
        permission = Permission.objects.get(
            content_type__app_label="portfolio", codename="change_artistprofile"
        )
        self.staff.user_permissions.add(permission)

    def test_anonymous_and_non_staff_users_cannot_read_layout(self):
        self.assertEqual(self.client.get(reverse("cms-layout")).status_code, 401)
        visitor = get_user_model().objects.create_user(username="layout-visitor")
        self.client.force_login(visitor)
        response = self.client.get(reverse("cms-layout"))
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json()["error"], "staff_required")

    def test_staff_can_read_default_layout_settings(self):
        self.client.force_login(self.staff)
        response = self.client.get(reverse("cms-layout"))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["settings"], DEFAULT_LAYOUT_SETTINGS)
        self.assertTrue(response.json()["permissions"]["canChange"])

    def test_editor_can_update_allow_listed_layout_settings(self):
        self.client.force_login(self.staff)
        response = self.client.patch(
            reverse("cms-layout"),
            data=json.dumps({"content_width": "wide", "gallery_columns": "4", "default_gallery_view": "grade"}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        self.profile.refresh_from_db()
        self.assertEqual(self.profile.layout_settings["content_width"], "wide")
        self.assertEqual(self.profile.layout_settings["gallery_columns"], "4")
        self.assertEqual(response.json()["settings"]["hero_alignment"], "center")

    def test_color_picker_accepts_hex_colors_and_persists_them(self):
        self.client.force_login(self.staff)
        response = self.client.patch(
            reverse("cms-layout"),
            data=json.dumps({"color_background": "#F4F1E8", "color_accent": "#9a735e"}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        self.profile.refresh_from_db()
        self.assertEqual(self.profile.layout_settings["color_background"], "#f4f1e8")
        self.assertEqual(response.json()["settings"]["color_accent"], "#9a735e")

    def test_invalid_colors_and_unknown_keys_are_rejected_without_saving(self):
        self.client.force_login(self.staff)
        for payload in ({"color_background": "red"}, {"color_accent": "#fff"}, {"color_text": "url(javascript:alert(1))"}, {"unknown": "#ffffff"}):
            response = self.client.patch(
                reverse("cms-layout"), data=json.dumps(payload), content_type="application/json"
            )
            self.assertEqual(response.status_code, 400)
        self.profile.refresh_from_db()
        self.assertEqual(self.profile.layout_settings, {})

    def test_invalid_values_and_unknown_keys_are_rejected_without_saving(self):
        self.client.force_login(self.staff)
        for payload in ({"content_width": "100vw"}, {"unknown": "anything"}, {"gallery_columns": 4}):
            response = self.client.patch(
                reverse("cms-layout"), data=json.dumps(payload), content_type="application/json"
            )
            self.assertEqual(response.status_code, 400)
        self.profile.refresh_from_db()
        self.assertEqual(self.profile.layout_settings, {})

    def test_staff_without_edit_permission_cannot_change_layout(self):
        readonly = get_user_model().objects.create_user(username="layout-readonly", is_staff=True)
        self.client.force_login(readonly)
        response = self.client.patch(
            reverse("cms-layout"), data=json.dumps({"content_width": "wide"}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json()["error"], "layout_edit_permission_required")

    def test_layout_updates_require_csrf(self):
        from django.test import Client
        client = Client(enforce_csrf_checks=True)
        client.force_login(self.staff)
        payload = json.dumps({"hero_alignment": "left"})
        rejected = client.patch(reverse("cms-layout"), data=payload, content_type="application/json")
        client.get(reverse("cms-layout"))
        token = client.cookies["csrftoken"].value
        accepted = client.patch(
            reverse("cms-layout"), data=payload, content_type="application/json",
            HTTP_X_CSRFTOKEN=token,
        )
        self.assertEqual(rejected.status_code, 403)
        self.assertEqual(accepted.status_code, 200)
