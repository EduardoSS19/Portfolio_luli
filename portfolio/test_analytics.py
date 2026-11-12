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

    def test_returns_historical_artwork_clicks_sources_and_city_breakdown(self):
        from types import SimpleNamespace
        from google.analytics.data_v1beta import BetaAnalyticsDataClient

        def response(dimensions, metrics):
            row = SimpleNamespace(
                dimension_values=[SimpleNamespace(value=value) for value in dimensions],
                metric_values=[SimpleNamespace(value=str(value)) for value in metrics],
            )
            return SimpleNamespace(rows=[row])

        client = MagicMock()
        client.run_report.side_effect = [
            response([], [20, 8, 30, 60, 100, 0.5]),
            response(["Porto Alegre", "Brazil"], [12, 18]),
            response(["google / organic"], [11]),
            response([], [7]),
            response(["Vaso azul"], [4]),
        ]
        client.run_realtime_report.return_value.rows = [
            SimpleNamespace(metric_values=[SimpleNamespace(value="2")])
        ]

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

        self.assertEqual(result["historical"]["metrics"]["artwork_clicks"], 7)
        self.assertEqual(result["historical"]["top_artworks"], [{"name": "Vaso azul", "clicks": 4}])
        self.assertEqual(result["historical"]["countries"], [{"name": "Porto Alegre, Brazil", "users": 12, "sessions": 18}])
        self.assertEqual(result["historical"]["sources"], [{"name": "google / organic", "sessions": 11}])
        self.assertEqual(result["realtime"]["active_users"], 2)

