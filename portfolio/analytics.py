"""Leitura agregada e histórica do Google Analytics 4 para o CMS."""
import json
import logging
import os

from django.core.cache import cache

logger = logging.getLogger(__name__)
REPORT_CACHE_SECONDS = 300
DEFAULT_PROPERTY_ID = "563474943"


def _report(client, property_id, dimensions, metrics, *, limit=10, dimension_filter=None):
    from google.analytics.data_v1beta.types import DateRange, Dimension, Metric, RunReportRequest

    request = RunReportRequest(
        property=f"properties/{property_id}",
        date_ranges=[DateRange(start_date="28daysAgo", end_date="today")],
        dimensions=[Dimension(name=name) for name in dimensions],
        metrics=[Metric(name=name) for name in metrics],
        limit=limit,
        dimension_filter=dimension_filter,
    )
    return client.run_report(request)


def _rows(response, dimension_count, metric_count):
    results = []
    for row in response.rows or []:
        dimensions = [value.value for value in row.dimension_values[:dimension_count]]
        metrics = [float(value.value) for value in row.metric_values[:metric_count]]
        results.append((dimensions, metrics))
    return results


def get_ga4_dashboard_data():
    """Retorna métricas históricas, origem, localização, obras abertas e usuários ao vivo."""
    property_id = os.environ.get("GA4_PROPERTY_ID", DEFAULT_PROPERTY_ID).strip()
    credentials_json = os.environ.get("GOOGLE_SERVICE_ACCOUNT_JSON", "").strip()
    if not credentials_json:
        return {"status": "not_configured", "historical": None, "realtime": None}

    cache_key = f"ga4_dashboard_v3_{property_id}"
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    try:
        from google.analytics.data_v1beta import BetaAnalyticsDataClient
        from google.analytics.data_v1beta.types import (
            Filter, FilterExpression, Metric, RunRealtimeReportRequest,
        )
        client = BetaAnalyticsDataClient.from_service_account_info(json.loads(credentials_json))
    except Exception:
        logger.exception("Não foi possível inicializar o cliente da Google Analytics Data API.")
        return {"status": "error", "historical": None, "realtime": None}

    historical = {"status": "error", "metrics": None}
    try:
        response = _report(
            client, property_id, [],
            ["activeUsers", "newUsers", "sessions", "screenPageViews", "eventCount", "engagementRate"],
            limit=1,
        )
        if response.rows:
            values = [float(value.value) for value in response.rows[0].metric_values]
            values += [0.0] * (6 - len(values))
            historical = {
                "status": "ok",
                "metrics": {
                    "active_users": int(values[0]),
                    "new_users": int(values[1]),
                    "sessions": int(values[2]),
                    "page_views": int(values[3]),
                    "events": int(values[4]),
                    "engagement_rate": round(values[5] * 100, 1),
                },
            }
        else:
            historical = {"status": "no_data", "metrics": None}
    except Exception:
        logger.exception("Não foi possível consultar o resumo histórico do GA4.")

    countries, sources, top_artworks = [], [], []
    try:
        response = _report(client, property_id, ["city", "country"], ["activeUsers", "sessions"])
        countries = [
            {"name": ", ".join(part for part in dims if part and part != "(not set)"), "users": int(metrics[0]), "sessions": int(metrics[1])}
            for dims, metrics in _rows(response, 2, 2) if any(part and part != "(not set)" for part in dims)
        ]
    except Exception:
        logger.exception("Não foi possível consultar a localização dos acessos no GA4.")

    try:
        response = _report(client, property_id, ["sessionSourceMedium"], ["sessions"])
        sources = [
            {"name": dims[0], "sessions": int(metrics[0])}
            for dims, metrics in _rows(response, 1, 1) if dims[0] not in ("", "(not set)")
        ]
    except Exception:
        logger.exception("Não foi possível consultar as origens dos acessos no GA4.")

    artwork_dimension_status = "not_available"
    artwork_clicks = None
    event_filter = FilterExpression(
        filter=Filter(
            field_name="eventName",
            string_filter=Filter.StringFilter(
                value="view_artwork",
                match_type=Filter.StringFilter.MatchType.EXACT,
            ),
        )
    )
    try:
        clicks_response = _report(
            client, property_id, [], ["eventCount"],
            limit=1, dimension_filter=event_filter,
        )
        artwork_clicks = int(clicks_response.rows[0].metric_values[0].value) if clicks_response.rows else 0
    except Exception:
        logger.exception("Não foi possível consultar os cliques em obras no GA4.")

    try:
        response = _report(
            client, property_id, ["customEvent:artwork_name"], ["eventCount"],
            limit=10, dimension_filter=event_filter,
        )
        top_artworks = [
            {"name": dims[0], "clicks": int(metrics[0])}
            for dims, metrics in _rows(response, 1, 1) if dims[0] not in ("", "(not set)")
        ]
        artwork_dimension_status = "ok"
    except Exception:
        # Para o ranking por obra, artwork_name precisa estar registrado como
        # dimensão personalizada de evento na propriedade GA4.
        artwork_dimension_status = "not_registered"
        logger.info("Dimensão personalizada artwork_name ainda não está disponível no GA4.")

    if historical.get("metrics") is not None:
        historical["metrics"]["artwork_clicks"] = artwork_clicks
    historical["countries"] = countries
    historical["sources"] = sources
    historical["top_artworks"] = top_artworks
    historical["artwork_dimension_status"] = artwork_dimension_status

    realtime = {"status": "error", "active_users": None}
    try:
        response = client.run_realtime_report(
            RunRealtimeReportRequest(
                property=f"properties/{property_id}",
                metrics=[Metric(name="activeUsers")],
            )
        )
        active_users = int(response.rows[0].metric_values[0].value) if response.rows else 0
        realtime = {"status": "ok", "active_users": active_users}
    except Exception:
        logger.exception("Não foi possível consultar usuários ativos em tempo real no GA4.")

    result = {"status": "ok", "historical": historical, "realtime": realtime}
    cache.set(cache_key, result, REPORT_CACHE_SECONDS)
    return result
