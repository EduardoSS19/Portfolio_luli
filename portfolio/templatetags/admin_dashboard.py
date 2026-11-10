from django import template

from portfolio.analytics import get_ga4_dashboard_data

from portfolio.models import (
    ArtistProfile,
    BackgroundFrame,
    Category,
    Reference,
    SocialLink,
    Work,
    WorkImage,
    WorkVideo,
)

register = template.Library()


@register.simple_tag
def dashboard_stats():
    """Resumo editorial do conteúdo, sem consultas por item."""
    return {
        "works_total": Work.objects.count(),
        "works_published": Work.objects.filter(is_active=True).count(),
        "works_draft": Work.objects.filter(is_active=False).count(),
        "categories": Category.objects.count(),
        "references": Reference.objects.count(),
        "videos": WorkVideo.objects.count(),
        "gallery_images": WorkImage.objects.count(),
        "backgrounds": BackgroundFrame.objects.count(),
        "social_links": SocialLink.objects.count(),
        "profile_ready": ArtistProfile.objects.exists(),
    }


@register.simple_tag
def ga4_dashboard():
    """Métricas agregadas do GA4, com cache e sem expor dados sensíveis."""
    return get_ga4_dashboard_data()
