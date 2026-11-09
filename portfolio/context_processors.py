from .models import SiteAppearance


def site_appearance(request):
    if not request.path.startswith("/admin/"):
        return {}
    appearance = SiteAppearance.get_solo()
    return {"site_appearance": appearance}
