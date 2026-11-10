"""Leitura agregada do Google Analytics 4 para o painel administrativo."""
import json
import logging
import os

from django.core.cache import cache

logger = logging.getLogger(__name__)
CACHE_SECONDS = 300
DEFAULT_PROPERTY_ID = "563474943"


def get_ga4_dashboard_data():
    """Retorna métricas dos últimos 28 dias; nunca expõe credenciais ou erros internos."""
    property_id = os.environ.get("GA4_PROPERTY_ID", DEFAULT_PROPERTY_ID).strip()
    credentials_json = os.environ.get("GOOGLE_SERVICE_ACCOUNT_JSON", "").strip()
    if not credentials_json:
        return {"status": "not_configured", "metrics": None}

    cache_key = f"ga4_dashboard_v1_{property_id}"
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    try:
        from google.analytics.data_v1beta import BetaAnalyticsDataClient
        from google.analytics.data_v1beta.types import DateRange, Metric, RunReportRequest

        credentials_info = json.loads(credentials_json)
        client = BetaAnalyticsDataClient.from_service_account_info(credentials_info)
        response = client.run_report(
            RunReportRequest(
                property=f"properties/{property_id}",
                date_ranges=[DateRange(start_date="28daysAgo", end_date="today")],
                metrics=[
                    Metric(name="activeUsers"),
                    Metric(name="sessions"),
                    Metric(name="screenPageViews"),
                    Metric(name="eventCount"),
                ],
            )
        )
        values = response.rows[0].metric_values if response.rows else []
        numbers = [int(value.value) for value in values]
        numbers += [0] * (4 - len(numbers))
        result = {
            "status": "ok",
            "period": "Últimos 28 dias",
            "metrics": {
                "active_users": numbers[0],
                "sessions": numbers[1],
                "page_views": numbers[2],
                "events": numbers[3],
            },
        }
        cache.set(cache_key, result, CACHE_SECONDS)
        return result
    except Exception:
        logger.exception("Não foi possível consultar a Google Analytics Data API.")
        return {"status": "error", "metrics": None}
