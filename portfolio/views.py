from django.conf import settings
from django.db.models import Prefetch
from django.http import FileResponse, Http404, JsonResponse
from django.shortcuts import redirect
from django.views.decorators.http import require_GET

from .models import ArtistProfile, Category, Reference, Work


def _image_url(uploaded_image, fallback):
    if uploaded_image:
        return uploaded_image.url

    image_url = fallback
    if image_url.startswith("/") and not image_url.startswith(("/static/", "/media/")):
        return f"/static{image_url}"
    return image_url


@require_GET
def portfolio_data(request):
    categories = Category.objects.filter(is_active=True).prefetch_related(
        Prefetch("works", queryset=Work.objects.filter(is_active=True))
    )
    references = Reference.objects.filter(is_active=True).prefetch_related("links")
    profile = ArtistProfile.objects.first()

    return JsonResponse(
        {
            "sobre": (
                {
                    "nome": profile.name,
                    "foto": _image_url(profile.photo, profile.photo_url),
                    "bio": [
                        paragraph.strip()
                        for paragraph in profile.bio.replace("\r\n", "\n").split("\n\n")
                        if paragraph.strip()
                    ],
                }
                if profile
                else None
            ),
            "categorias": [
                {
                    "titulo": category.title,
                    "chave": category.key,
                    "obras": [
                        {
                            "titulo": work.title,
                            "imagem": _image_url(work.image, work.image_url),
                            "descricao": work.description,
                            "detalhe": work.detail,
                        }
                        for work in category.works.all()
                    ],
                }
                for category in categories
            ],
            "referencias": [
                {
                    "titulo": reference.title,
                    "periodo": reference.period,
                    "links": [
                        {"texto": link.text, "url": link.url}
                        for link in reference.links.all()
                    ],
                }
                for reference in references
            ],
        }
    )


@require_GET
def healthcheck(request):
    return JsonResponse({"status": "ok"})


@require_GET
def frontend(request):
    if settings.DEBUG:
        return redirect("http://127.0.0.1:5173/")

    index_file = settings.FRONTEND_DIST / "index.html"
    if not index_file.is_file():
        raise Http404("Frontend ainda não compilado.")
    return FileResponse(index_file.open("rb"), content_type="text/html")