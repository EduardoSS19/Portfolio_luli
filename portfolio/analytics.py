"""Leitura agregada do Google Analytics 4 para o painel administrativo."""
import json
import logging
import os

from django.core.cache import cache

logger = logging.getLogger(__name__)
REPORT_CACHE_SECONDS = 300
REALTIME_CACHE_SECONDS = 60
DEFAULT_PROPERTY_ID = "563474943"


def get_ga4_dashboard_data():
    """Retorna métricas históricas e em tempo real sem expor credenciais."""
    property_id = os.environ.get("GA4_PROPERTY_ID", DEFAULT_PROPERTY_ID).strip()
    credentials_json = os.environ.get("GOOGLE_SERVICE_ACCOUNT_JSON", "").strip()
    if not credentials_json:
        return {"status": "not_configured", "historical": None, "realtime": None}

    try:
        from google.analytics.data_v1beta import BetaAnalyticsDataClient
        from google.analytics.data_v1beta.types import DateRange, Metric, RealtimeReportRequest, RunReportRequest

        credentials_info = json.loads(credentials_json)
        client = BetaAnalyticsDataClient.from_service_account_info(credentials_info)
    except Exception:
        logger.exception("Não foi possível inicializar o cliente da Google Analytics Data API.")
        return {"status": "error", "historical": None, "realtime": None}

    historical_key = f"ga4_dashboard_v2_{property_id}"
    historical = cache.get(historical_key)
    if historical is None:
        try:
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
            if response.rows:
                values = [int(value.value) for value in response.rows[0].metric_values]
                values += [0] * (4 - len(values))
                historical = {
                    "status": "ok",
                    "metrics": {
                        "active_users": values[0],
                        "sessions": values[1],
                        "page_views": values[2],
                        "events": values[3],
                    },
                }
            else:
                historical = {"status": "no_data", "metrics": None}
            cache.set(historical_key, historical, REPORT_CACHE_SECONDS)
        except Exception:
            logger.exception("Não foi possível consultar os relatórios históricos do GA4.")
            historical = {"status": "error", "metrics": None}

    realtime_key = f"ga4_realtime_dashboard_v1_{property_id}"
    realtime = cache.get(realtime_key)
    if realtime is None:
        try:
            response = client.run_realtime_report(
                RealtimeReportRequest(
                    property=f"properties/{property_id}",
                    metrics=[Metric(name="activeUsers")],
                )
            )
            active_users = int(response.rows[0].metric_values[0].value) if response.rows else 0
            realtime = {"status": "ok", "active_users": active_users}
            cache.set(realtime_key, realtime, REALTIME_CACHE_SECONDS)
        except Exception:
            logger.exception("Não foi possível consultar usuários ativos em tempo real no GA4.")
            realtime = {"status": "error", "active_users": None}

    return {"status": "ok", "historical": historical, "realtime": realtime}
