import json
import os
from unittest import TestCase
from unittest.mock import MagicMock, patch

from django.core.cache import cache

from portfolio.analytics import get_ga4_dashboard_data


class GoogleAnalyticsDashboardTests(TestCase):
    def setUp(self):
        cache.clear()

    def test_reports_missing_credentials_without_calling_google(self):
        with patch.dict(os.environ, {"GOOGLE_SERVICE_ACCOUNT_JSON": ""}):
            result = get_ga4_dashboard_data()

        self.assertEqual(result["status"], "not_configured")
        self.assertIsNone(result["historical"])
        self.assertIsNone(result["realtime"])

    def test_returns_realtime_users_when_historical_report_is_empty(self):
        from google.analytics.data_v1beta import BetaAnalyticsDataClient

        realtime_row = MagicMock()
        realtime_row.metric_values = [MagicMock(value="3")]
        client = MagicMock()
        client.run_report.return_value.rows = []
        client.run_realtime_report.return_value.rows = [realtime_row]

        with (
            patch.dict(
                os.environ,
                {
                    "GOOGLE_SERVICE_ACCOUNT_JSON": json.dumps({"type": "service_account"}),
                    "GA4_PROPERTY_ID": "563474943",
                },
            ),
            patch.object(BetaAnalyticsDataClient, "from_service_account_info", return_value=client),
        ):
            result = get_ga4_dashboard_data()

        self.assertEqual(result["historical"]["status"], "no_data")
        self.assertEqual(result["realtime"], {"status": "ok", "active_users": 3})
        client.run_realtime_report.assert_called_once()
