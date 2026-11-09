import json
import logging
from html import escape
from smtplib import SMTPException

from django.conf import settings
from django.core import signing
from django.core.exceptions import ValidationError
from django.core.signing import BadSignature, SignatureExpired
from django.core.mail import EmailMessage
from django.core.validators import validate_email
from django.db.models import Prefetch, Q
from django.http import FileResponse, Http404, HttpResponse, JsonResponse
from django.shortcuts import redirect
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.http import require_GET, require_POST

from .models import ArtistProfile, BackgroundFrame, Category, Reference, SocialLink, Work


logger = logging.getLogger(__name__)


def _otimizada(url, largura, extra=""):
    """Pede ao Cloudinary uma versão leve: formato moderno, qualidade automática e
    largura limitada. O arquivo original continua intacto no Cloudinary."""
    marcador = "/upload/"
    if "res.cloudinary.com" not in url or marcador not in url:
        return url
    antes, depois = url.split(marcador, 1)
    if depois.startswith(("f_", "q_", "w_", "c_")):
        return url
    efeitos = f",{extra}" if extra else ""
    return f"{antes}{marcador}f_auto,q_auto,w_{largura}{efeitos}/{depois}"


def _image_url(uploaded_image, fallback, largura=1400):
    if uploaded_image:
        return _otimizada(uploaded_image.url, largura)

    image_url = fallback
    if image_url.startswith("/") and not image_url.startswith(("/static/", "/media/")):
        return f"/static{image_url}"
    return image_url


def _work_data(work):
    images = (
        [_image_url(work.image, work.image_url)]
        if work.image or work.image_url
        else []
    )
    images.extend(_otimizada(image.image.url, 1400) for image in work.gallery_images.all())

    media = []
    if work.image or work.image_url:
        media.append((-1, 0, {
            "tipo": "imagem",
            "src": _image_url(work.image, work.image_url),
        }))

    media.extend(
        (
            image.position,
            image.pk,
            {"tipo": "imagem", "src": _otimizada(image.image.url, 1400)},
        )
        for image in work.gallery_images.all()
    )
    media.extend(
        (
            video.position,
            video.pk,
            {
                "tipo": "youtube",
                "videoId": video.video_id,
                "titulo": video.video_title,
                "miniatura": video.thumbnail_url,
            },
        )
        for video in work.youtube_videos.all()
    )

    return {
        "titulo": work.title,
        "imagem": images[0] if images else "",
        "imagens": images,
        "midias": [item[2] for item in sorted(media, key=lambda item: (item[0], item[1]))],
        "descricao": work.description,
        "detalhe": work.detail,
        "fichaTecnica": {
            "tecnica": work.technique,
            "material": work.material,
            "suporte": work.support,
            "ano": work.year,
            "dimensoes": {
                "altura": str(work.height) if work.height is not None else "",
                "largura": str(work.width) if work.width is not None else "",
                "profundidade": str(work.depth) if work.depth is not None else "",
                "unidade": work.dimension_unit or "cm",
            },
            "preco": str(work.price) if work.price is not None else "",
            "moeda": work.currency or "BRL",
            "disponibilidade": work.get_availability_display() if work.availability else "",
            "serie": work.series,
            "edicao": work.edition,
            "tiragem": work.print_run,
            "assinada": work.signed,
            "localCriacao": work.creation_location,
            "conservacao": work.condition,
            "exposicoes": work.exhibitions,
        },
    }


@require_GET
@ensure_csrf_cookie
def portfolio_data(request):
    preview_work = None
    preview_token = request.GET.get("preview_token")
    if preview_token:
        if not request.user.is_authenticated or not request.user.is_staff:
            return JsonResponse({"erro": "Prévia disponível apenas para a equipe."}, status=403)
        try:
            preview_payload = signing.loads(
                preview_token,
                salt="portfolio.work-preview",
                max_age=600,
            )
        except (BadSignature, SignatureExpired):
            return JsonResponse({"erro": "Este link de prévia expirou. Gere outro pelo painel."}, status=403)
        if preview_payload.get("user") != request.user.pk:
            return JsonResponse({"erro": "Este link de prévia pertence a outro usuário."}, status=403)
        preview_work = Work.objects.filter(pk=preview_payload.get("work")).first()
        if not preview_work:
            return JsonResponse({"erro": "A obra desta prévia não existe mais."}, status=404)

    works_queryset = Work.objects.filter(is_active=True)
    categories_queryset = Category.objects.filter(is_active=True, works__is_active=True).distinct()
    if preview_work:
        works_queryset = Work.objects.filter(Q(is_active=True) | Q(pk=preview_work.pk))
        categories_queryset = Category.objects.filter(is_active=True).filter(
            Q(works__is_active=True) | Q(pk=preview_work.category_id)
        ).distinct()

    categories = categories_queryset.prefetch_related(
        Prefetch(
            "works",
            queryset=works_queryset.prefetch_related("gallery_images", "youtube_videos"),
        )
    )
    references = Reference.objects.filter(is_active=True).prefetch_related("links")
    profile = ArtistProfile.objects.first()
    frames = BackgroundFrame.objects.filter(is_active=True)
    social_links = SocialLink.objects.filter(is_active=True)

    payload = {
            "sobre": (
                {
                    "nome": profile.name,
                    "frase": profile.tagline,
                    "foto": _image_url(profile.photo, profile.photo_url, 1000),
                    "instagram": profile.instagram_url,
                    "email": profile.contact_email,
                    "formulario": profile.contact_form_url,
                    # Mantém as quebras simples e os parágrafos exatamente como
                    # foram escritos no painel. O frontend usa white-space: pre-line.
                    "bio": profile.bio.replace("\r\n", "\n").replace("\r", "\n"),
                }
                if profile
                else None
            ),
            "frames": [_otimizada(frame.image.url, 900, "e_saturation:-35") for frame in frames],
            "redes": [
                {"titulo": social.title, "url": social.url}
                for social in social_links
            ],
            "categorias": [
                {
                    "titulo": category.title,
                    "chave": category.key,
                    "obras": [_work_data(work) for work in category.works.all()],
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
    if preview_work:
        payload["preview"] = {"id": preview_work.pk, "titulo": preview_work.title}
    return JsonResponse(payload)


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
        return redirect(f"http://127.0.0.1:5173/{request.META.get('QUERY_STRING') and '?' + request.META['QUERY_STRING'] or ''}")

    index_file = settings.FRONTEND_DIST / "index.html"
    if not index_file.is_file():
        raise Http404("Frontend ainda não compilado.")
    html = index_file.read_text(encoding="utf-8")
    profile = ArtistProfile.objects.first()
    obra_destaque = (
        Work.objects.filter(
            is_share_image=True,
            is_active=True,
            category__is_active=True,
        )
        .select_related("category")
        .first()
    )

    titulo = profile.name if profile and profile.name else "Luli Becker"
    descricao = "Portfólio digital"

    imagem = ""
    if obra_destaque:
        imagem = _image_url(obra_destaque.image, obra_destaque.image_url, 1200)
    if not imagem and profile:
        imagem = _image_url(profile.photo, profile.photo_url, 1200)
    if imagem:
        imagem = request.build_absolute_uri(imagem)

    tags = [
        f'<meta name="description" content="{escape(descricao, quote=True)}" />',
        '<meta property="og:type" content="website" />',
        f'<meta property="og:url" content="{escape(request.build_absolute_uri(request.path), quote=True)}" />',
        f'<meta property="og:title" content="{escape(titulo, quote=True)}" />',
        f'<meta property="og:description" content="{escape(descricao, quote=True)}" />',
        '<meta name="twitter:card" content="summary_large_image" />',
        f'<meta name="twitter:title" content="{escape(titulo, quote=True)}" />',
        f'<meta name="twitter:description" content="{escape(descricao, quote=True)}" />',
    ]
    if imagem:
        tags.extend([
            f'<meta property="og:image" content="{escape(imagem, quote=True)}" />',
            f'<meta property="og:image:alt" content="{escape(titulo, quote=True)}" />',
            f'<meta name="twitter:image" content="{escape(imagem, quote=True)}" />',
        ])

    # Redes sociais leem o HTML inicial e não executam o React; por isso os
    # metadados são montados no Django antes de entregar o index do frontend.
    html = html.replace("</head>", "\n    " + "\n    ".join(tags) + "\n  </head>", 1)
    if '<title>Portfólio</title>' in html:
        html = html.replace('<title>Portfólio</title>', f'<title>{escape(titulo)}</title>', 1)
    return HttpResponse(html, content_type="text/html; charset=utf-8")