from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse


class CmsAnalyticsApiTests(TestCase):
    def test_anonymous_request_is_rejected(self):
        response = self.client.get(reverse("cms-analytics"))
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json(), {"error": "authentication_required"})

    def test_non_staff_request_is_rejected(self):
        user = get_user_model().objects.create_user(
            username="analytics-visitor", password="test-password-123"
        )
        self.client.force_login(user)
        response = self.client.get(reverse("cms-analytics"))
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json(), {"error": "staff_required"})

    @patch("portfolio.cms_analytics.get_ga4_dashboard_data")
    def test_staff_receives_aggregated_metrics_without_credentials(self, get_data):
        staff = get_user_model().objects.create_user(
            username="analytics-staff", password="test-password-123", is_staff=True
        )
        payload = {
            "status": "ok",
            "historical": {"status": "ok", "metrics": {
                "active_users": 12, "sessions": 18, "page_views": 31, "events": 74,
            }},
            "realtime": {"status": "ok", "active_users": 2},
        }
        get_data.return_value = payload
        self.client.force_login(staff)

        response = self.client.get(reverse("cms-analytics"))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), payload)
        self.assertNotIn("GOOGLE_SERVICE_ACCOUNT_JSON", response.content.decode())
        self.assertIn("no-store", response["Cache-Control"])
        get_data.assert_called_once_with()

    @patch("portfolio.cms_analytics.get_ga4_dashboard_data")
    def test_unconfigured_analytics_is_a_valid_staff_response(self, get_data):
        staff = get_user_model().objects.create_user(
            username="analytics-unconfigured", password="test-password-123", is_staff=True
        )
        get_data.return_value = {"status": "not_configured", "historical": None, "realtime": None}
        self.client.force_login(staff)

        response = self.client.get(reverse("cms-analytics"))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "not_configured")
