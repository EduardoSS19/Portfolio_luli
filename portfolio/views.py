import json
import logging
from smtplib import SMTPException

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.mail import EmailMessage
from django.core.validators import validate_email
from django.db.models import Prefetch
from django.http import FileResponse, Http404, JsonResponse
from django.shortcuts import redirect
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.http import require_GET, require_POST

from .models import ArtistProfile, BackgroundFrame, Category, Reference, SocialLink, Work


logger = logging.getLogger(__name__)


def _image_url(uploaded_image, fallback):
    if uploaded_image:
        return uploaded_image.url

    image_url = fallback
    if image_url.startswith("/") and not image_url.startswith(("/static/", "/media/")):
        return f"/static{image_url}"
    return image_url


@require_GET
@ensure_csrf_cookie
def portfolio_data(request):
    categories = Category.objects.filter(is_active=True).prefetch_related(
        Prefetch(
            "works",
            queryset=Work.objects.filter(is_active=True).prefetch_related("gallery_images"),
        )
    )
    references = Reference.objects.filter(is_active=True).prefetch_related("links")
    profile = ArtistProfile.objects.first()
    frames = BackgroundFrame.objects.filter(is_active=True)
    social_links = SocialLink.objects.filter(is_active=True)

    return JsonResponse(
        {
            "sobre": (
                {
                    "nome": profile.name,
                    "frase": profile.tagline,
                    "foto": _image_url(profile.photo, profile.photo_url),
                    "instagram": profile.instagram_url,
                    "email": profile.contact_email,
                    "formulario": profile.contact_form_url,
                    "bio": [
                        paragraph.strip()
                        for paragraph in profile.bio.replace("\r\n", "\n").split("\n\n")
                        if paragraph.strip()
                    ],
                }
                if profile
                else None
            ),
            "frames": [frame.image.url for frame in frames],
            "redes": [
                {"titulo": social.title, "url": social.url}
                for social in social_links
            ],
            "categorias": [
                {
                    "titulo": category.title,
                    "chave": category.key,
                    "obras": [
                        {
                            "titulo": work.title,
                            "imagem": _image_url(work.image, work.image_url),
                            "imagens": [
                                *(
                                    [_image_url(work.image, work.image_url)]
                                    if work.image or work.image_url
                                    else []
                                ),
                                *[
                                    image.image.url
                                    for image in work.gallery_images.all()
                                ],
                            ],
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


@require_POST
def contact(request):
    try:
        if request.content_type == "application/json":
            data = json.loads(request.body)
        else:
            data = request.POST
    except (json.JSONDecodeError, UnicodeDecodeError):
        return JsonResponse({"erro": "Não foi possível ler os dados enviados."}, status=400)

    if not isinstance(data, dict) and not hasattr(data, "get"):
        return JsonResponse({"erro": "Os dados enviados são inválidos."}, status=400)

    if str(data.get("website", "")).strip():
        return JsonResponse({"status": "ok"})

    nome = " ".join(str(data.get("nome", "")).splitlines()).strip()
    email = str(data.get("email", "")).strip()
    assunto = " ".join(str(data.get("assunto", "")).splitlines()).strip()
    mensagem = str(data.get("mensagem", "")).strip()

    if not nome or len(nome) > 120:
        return JsonResponse({"erro": "Informe um nome com até 120 caracteres."}, status=400)
    if not email or len(email) > 254:
        return JsonResponse({"erro": "Informe um endereço de e-mail válido."}, status=400)
    try:
        validate_email(email)
    except ValidationError:
        return JsonResponse({"erro": "Informe um endereço de e-mail válido."}, status=400)
    if len(assunto) > 160:
        return JsonResponse({"erro": "O assunto deve ter até 160 caracteres."}, status=400)
    if not mensagem or len(mensagem) > 10000:
        return JsonResponse({"erro": "A mensagem deve ter entre 1 e 10.000 caracteres."}, status=400)

    profile = ArtistProfile.objects.first()
    if not profile or not profile.contact_email:
        logger.warning("Contato não enviado: e-mail de destino não configurado no perfil.")
        return JsonResponse({"erro": "O contato está temporariamente indisponível."}, status=503)

    if settings.EMAIL_BACKEND.endswith("smtp.EmailBackend") and (
        not settings.EMAIL_HOST or not settings.DEFAULT_FROM_EMAIL
    ):
        logger.error("Contato não enviado: configuração SMTP incompleta.")
        return JsonResponse({"erro": "O envio de e-mail está temporariamente indisponível."}, status=503)

    titulo = assunto or f"Mensagem de {nome}"
    corpo = (
        f"Nome: {nome}\n"
        f"E-mail: {email}\n"
        f"Assunto: {assunto or 'Não informado'}\n\n"
        f"Mensagem:\n{mensagem}"
    )
    mensagem_email = EmailMessage(
        subject=f"Contato pelo portfólio: {titulo}",
        body=corpo,
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=[profile.contact_email],
        reply_to=[email],
    )

    try:
        enviada = mensagem_email.send(fail_silently=False)
    except (OSError, SMTPException, ValueError):
        logger.exception("Falha ao enviar mensagem recebida pelo formulário de contato.")
        return JsonResponse({"erro": "Não foi possível enviar a mensagem agora."}, status=503)

    if enviada != 1:
        logger.error("O backend de e-mail não confirmou o envio da mensagem de contato.")
        return JsonResponse({"erro": "Não foi possível enviar a mensagem agora."}, status=503)

    return JsonResponse({"status": "ok"})


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