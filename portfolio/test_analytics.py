import os
from unittest import TestCase
from unittest.mock import patch

from portfolio.analytics import get_ga4_dashboard_data


class GoogleAnalyticsDashboardTests(TestCase):
    def test_reports_missing_credentials_without_calling_google(self):
        with patch.dict(os.environ, {"GOOGLE_SERVICE_ACCOUNT_JSON": ""}):
            result = get_ga4_dashboard_data()

        self.assertEqual(result["status"], "not_configured")
        self.assertIsNone(result["metrics"])
