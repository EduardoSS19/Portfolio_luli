from django.conf import settings
from django.db.models import Prefetch
from django.http import FileResponse, Http404, JsonResponse
from django.views.decorators.http import require_GET

from .models import Category, Reference, Work


def _work_image_url(work):
    if work.image:
        return work.image.url

    image_url = work.image_url
    if image_url.startswith("/") and not image_url.startswith(("/static/", "/media/")):
        return f"/static{image_url}"
    return image_url


@require_GET
def portfolio_data(request):
    categories = Category.objects.filter(is_active=True).prefetch_related(
        Prefetch("works", queryset=Work.objects.filter(is_active=True))
    )
    references = Reference.objects.filter(is_active=True).prefetch_related("links")

    return JsonResponse(
        {
            "categorias": [
                {
                    "titulo": category.title,
                    "chave": category.key,
                    "obras": [
                        {
                            "titulo": work.title,
                            "imagem": _work_image_url(work),
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
    index_file = settings.FRONTEND_DIST / "index.html"
    if not index_file.is_file():
        raise Http404("Frontend ainda não compilado.")
    return FileResponse(index_file.open("rb"), content_type="text/html")