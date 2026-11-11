"""Staff-only read endpoint for the CMS Google Analytics summary."""
from django.http import JsonResponse
from django.views.decorators.cache import never_cache
from django.views.decorators.http import require_GET

from .analytics import get_ga4_dashboard_data
from .cms_api import _staff_required


@require_GET
@never_cache
@_staff_required
def cms_analytics(request):
    """Expose aggregate GA4 metrics to authenticated CMS staff only."""
    return JsonResponse(get_ga4_dashboard_data())
