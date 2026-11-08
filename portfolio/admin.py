from django import forms
from django.contrib import admin, messages
from django.core import signing
from django.core.files.uploadedfile import UploadedFile
from django.db.models import Count, Max
from django.db.models import ImageField as ModelImageField
from django.http import Http404, HttpResponseBadRequest, JsonResponse
from django.shortcuts import redirect
from django.urls import path, reverse
from django.utils.html import format_html

from .models import (
    ArtistProfile,
    BackgroundFrame,
    Category,
    Reference,
    ReferenceLink,
    SocialLink,
    Work,
    WorkImage,
    WorkVideo,
)
from .youtube import YouTubeMetadataError, fetch_youtube_video_metadata


admin.site.site_header = "Portfólio — painel editorial"
admin.site.site_title = "Painel do portfólio"
admin.site.index_title = "O que você quer editar?"


# ---------------------------------------------------------------------------
# Utilitários
# ---------------------------------------------------------------------------

def miniatura(imagem, url_alternativa="", tamanho=64):
    """Quadradinho com a imagem, para reconhecer a obra de relance nas listas."""
    url = ""
    if imagem:
        try:
            url = imagem.url
        except ValueError:
            url = ""
    if not url and url_alternativa.startswith("http"):
        url = url_alternativa
    if not url:
        return "—"
    return format_html(
        '<img src="{}" alt="" loading="lazy" '
        'style="width:{}px;height:{}px;object-fit:cover;border-radius:6px">',
        url,
        tamanho,
        tamanho,
    )


class MultipleFileInput(forms.ClearableFileInput):
    allow_multiple_selected = True


MAX_IMAGE_UPLOAD_SIZE = 15 * 1024 * 1024


class MultipleImageField(forms.ImageField):
    """Campo que aceita várias imagens de uma vez (cada uma é validada como imagem)."""

    def __init__(self, *args, **kwargs):
        kwargs.setdefault("widget", MultipleFileInput(attrs={"accept": "image/*"}))
        super().__init__(*args, **kwargs)

    def clean(self, data, initial=None):
        limpar = super().clean

        def validar(arquivo):
            imagem = limpar(arquivo, initial)
            if imagem and imagem.size > MAX_IMAGE_UPLOAD_SIZE:
                raise forms.ValidationError(
                    "Cada imagem deve ter no máximo 15 MB."
                )
            return imagem

        if isinstance(data, (list, tuple)):
            return [validar(arquivo) for arquivo in data if arquivo]
        return [validar(data)] if data else []


class ImagemSalvaMixin:
    """Não revalida a extensão de imagens que já estão salvas.

    O Cloudinary guarda o nome do arquivo sem ".jpg"/".png". O validador de extensão
    do modelo reprovava esse nome ao editar qualquer coisa, e o painel pedia para
    enviar a imagem de novo. Aqui só validamos arquivos recém-enviados.
    """

    def _get_validation_exclusions(self):
        excluir = super()._get_validation_exclusions()
        for campo in self.instance._meta.fields:
            if isinstance(campo, ModelImageField) and campo.name in self.fields:
                if not isinstance(self.cleaned_data.get(campo.name), UploadedFile):
                    excluir.add(campo.name)
        return excluir

    def clean(self):
        cleaned_data = super().clean()
        for nome, valor in cleaned_data.items():
            if isinstance(valor, UploadedFile) and valor.size > MAX_IMAGE_UPLOAD_SIZE:
                self.add_error(nome, "A imagem deve ter no máximo 15 MB.")
        return cleaned_data


class ImagemExistenteForm(ImagemSalvaMixin, forms.ModelForm):
    pass


def proxima_posicao(queryset):
    ultimo = queryset.aggregate(ultimo=Max("position"))["ultimo"]
    return 0 if ultimo is None else ultimo + 1


# ---------------------------------------------------------------------------
# Perfil e redes
# ---------------------------------------------------------------------------

@admin.register(ArtistProfile)
class ArtistProfileAdmin(admin.ModelAdmin):
    form = ImagemExistenteForm
    list_display = ("name", "tagline", "contact_email")
    list_per_page = 1
    fieldsets = (
        (
            "Apresentação",
            {
                "fields": ("name", "tagline", "photo", "photo_url", "bio"),
                "description": (
                    "Estas informações aparecem na página inicial e na seção Sobre. "
                    "No campo biografia, use Enter para quebrar linhas; o site exibirá "
                    "as quebras exatamente como você escreveu."
                ),
            },
        ),
        (
            "Contato e redes",
            {
                "fields": ("instagram_url", "contact_email", "contact_form_url"),
                "description": (
                    "O e-mail recebe as mensagens enviadas pelo formulário do site. "
                    "O formulário externo é usado quando não há e-mail configurado."
                ),
            },
        ),
    )
    save_on_top = True

    def has_add_permission(self, request):
        return not ArtistProfile.objects.exists()

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(SocialLink)
class SocialLinkAdmin(admin.ModelAdmin):
    list_display = ("title", "url", "position", "is_active")
    list_display_links = ("title",)
    list_filter = ("is_active",)
    list_per_page = 25
    save_on_top = True
    list_editable = ("position", "is_active")
    ordering = ("position", "id")
    search_fields = ("title", "url")
    fieldsets = (
        ("Link", {"fields": ("title", "url")}),
        ("Organização", {"fields": ("position", "is_active")}),
    )


# ---------------------------------------------------------------------------
# Imagens de fundo (com envio de várias de uma vez)
# ---------------------------------------------------------------------------

class BackgroundFrameForm(ImagemSalvaMixin, forms.ModelForm):
    imagens = MultipleImageField(
        label="Enviar várias imagens de uma vez",
        required=False,
        help_text="Selecione quantas quiser. Cada uma vira uma imagem de fundo, na ordem escolhida.",
    )

    class Meta:
        model = BackgroundFrame
        fields = ("image", "position", "is_active")

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if not self.instance.pk:
            self.fields["image"].required = False

    def clean(self):
        cleaned_data = super().clean()
        if not self.instance.pk and not cleaned_data.get("image") and not cleaned_data.get("imagens"):
            raise forms.ValidationError("Envie pelo menos uma imagem.")
        return cleaned_data


@admin.register(BackgroundFrame)
class BackgroundFrameAdmin(admin.ModelAdmin):
    form = BackgroundFrameForm
    list_display = ("preview", "__str__", "position", "is_active")
    list_display_links = ("preview", "__str__")
    list_editable = ("position", "is_active")
    ordering = ("position", "id")
    list_per_page = 40
    list_filter = ("is_active",)
    save_on_top = True
    actions = ("publicar", "despublicar")

    @admin.display(description="Imagem")
    def preview(self, obj):
        return miniatura(obj.image)

    def save_model(self, request, obj, form, change):
        novas = form.cleaned_data.get("imagens") or []
        if not change and not obj.image and novas:
            obj.image = novas.pop(0)
        super().save_model(request, obj, form, change)

        if change or not novas:
            return
        posicao = proxima_posicao(BackgroundFrame.objects)
        for arquivo in novas:
            BackgroundFrame.objects.create(
                image=arquivo, position=posicao, is_active=obj.is_active
            )
            posicao += 1
        messages.info(request, f"{len(novas) + 1} imagens de fundo foram adicionadas.")

    @admin.action(description="Publicar selecionadas")
    def publicar(self, request, queryset):
        self.message_user(request, f"{queryset.update(is_active=True)} publicada(s).")

    @admin.action(description="Despublicar selecionadas (esconder sem apagar)")
    def despublicar(self, request, queryset):
        self.message_user(request, f"{queryset.update(is_active=False)} despublicada(s).")


# ---------------------------------------------------------------------------
# Vídeos do YouTube
# ---------------------------------------------------------------------------

class WorkVideoFormMixin:
    """Busca título e miniatura na API do YouTube quando o link muda."""

    def clean(self):
        cleaned_data = super().clean()
        youtube_url = cleaned_data.get("youtube_url")
        instance = self.instance
        if youtube_url and (
            not instance.pk
            or youtube_url != instance.youtube_url
            or not instance.video_id
        ):
            try:
                cleaned_data["youtube_metadata"] = fetch_youtube_video_metadata(youtube_url)
            except YouTubeMetadataError as error:
                self.add_error("youtube_url", str(error))
        return cleaned_data

    def save(self, commit=True):
        obj = super().save(commit=False)
        metadata = self.cleaned_data.get("youtube_metadata")
        if metadata:
            obj.video_id = metadata["video_id"]
            obj.video_title = metadata["title"]
            obj.thumbnail_url = metadata["thumbnail_url"]
        if commit:
            obj.save()
        return obj


class WorkVideoAdminForm(WorkVideoFormMixin, forms.ModelForm):
    class Meta:
        model = WorkVideo
        fields = ("work", "youtube_url", "position")


class WorkVideoInlineForm(WorkVideoFormMixin, forms.ModelForm):
    class Meta:
        model = WorkVideo
        fields = ("youtube_url", "position")


@admin.register(WorkVideo)
class WorkVideoAdmin(admin.ModelAdmin):
    form = WorkVideoAdminForm
    list_display = ("preview", "work", "video_title", "position")
    list_display_links = ("preview", "work", "video_title")
    list_per_page = 30
    save_on_top = True
    list_filter = ("work__category",)
    list_select_related = ("work", "work__category")
    list_editable = ("position",)
    ordering = ("work__category__position", "work__position", "position", "id")
    search_fields = ("work__title", "video_title", "video_id")
    fieldsets = (
        ("Vídeo", {
            "fields": ("work", "youtube_url"),
            "description": "Cole o link de um vídeo do YouTube. O título e a miniatura são preenchidos automaticamente ao salvar.",
        }),
        ("Organização", {"fields": ("position",)}),
    )

    @admin.display(description="Prévia")
    def preview(self, obj):
        return miniatura(None, obj.thumbnail_url, tamanho=96)


# ---------------------------------------------------------------------------
# Obras (tudo da obra numa página só)
# ---------------------------------------------------------------------------

class WorkImageInline(admin.TabularInline):
    model = WorkImage
    form = ImagemExistenteForm
    extra = 0
    fields = ("preview", "image", "position")
    readonly_fields = ("preview",)
    verbose_name = "imagem do carrossel"
    verbose_name_plural = "imagens do carrossel (marque “Apagar” para remover)"

    @admin.display(description="Prévia")
    def preview(self, obj):
        return miniatura(obj.image, tamanho=96) if obj.pk else "—"


class WorkVideoInline(admin.TabularInline):
    model = WorkVideo
    form = WorkVideoInlineForm
    extra = 0
    fields = ("youtube_url", "position")
    verbose_name = "vídeo do YouTube"
    verbose_name_plural = "vídeos do YouTube (marque “Apagar” para remover)"


class WorkAdminForm(ImagemSalvaMixin, forms.ModelForm):
    novas_imagens = MultipleImageField(
        label="Adicionar várias imagens ao carrossel",
        required=False,
        help_text=(
            "Selecione quantas fotos quiser de uma vez. Elas entram no fim do carrossel, "
            "e você pode ajustar a ordem depois na tabela de imagens abaixo."
        ),
    )

    class Meta:
        model = Work
        fields = "__all__"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["is_active"].label = "Publicada no site"
        self.fields["is_active"].help_text = (
            "Desmarque para salvar como rascunho. Rascunhos não aparecem no site público."
        )
        if not self.instance.pk:
            self.fields["is_active"].initial = False


@admin.register(Work)
class WorkAdmin(admin.ModelAdmin):
    form = WorkAdminForm
    list_display = ("preview", "title", "category", "total_imagens", "position", "is_active")
    list_display_links = ("preview", "title")
    list_editable = ("position", "is_active")
    list_filter = ("category", "is_active")
    list_select_related = ("category",)
    search_fields = ("title", "description")
    ordering = ("category__position", "position", "id")
    list_per_page = 30
    save_on_top = True
    actions = ("publicar", "despublicar")
    inlines = (WorkImageInline, WorkVideoInline)
    fieldsets = (
        ("Comece por aqui", {
            "fields": ("category", "title", "description"),
            "description": "Identifique a obra e conte um pouco sobre ela. Os campos técnicos são opcionais.",
        }),
        ("Ficha técnica", {
            "fields": ("technique", "material", "support", "year", ("height", "width", "depth", "dimension_unit")),
            "description": "Preencha apenas o que fizer sentido para esta obra. Informações vazias não aparecem no site.",
        }),
        ("Informações comerciais", {
            "fields": ("price", "currency", "availability"),
        }),
        ("Série e produção", {
            "fields": ("series", "edition", "print_run", "signed", "creation_location", "condition", "exhibitions"),
            "classes": ("collapse",),
        }),
        ("Observações adicionais", {"fields": ("detail",)}),
        ("Imagens da obra", {
            "fields": ("image", "novas_imagens"),
            "description": "A primeira imagem é a capa. Adicione outras fotos para mostrar detalhes e ângulos diferentes.",
        }),
        ("Publicação", {"fields": ("position", "is_active", "preview_site")}),
        ("Avançado", {"fields": ("image_url",), "classes": ("collapse",)}),
    )

    readonly_fields = ("preview_site",)

    def get_urls(self):
        urls = super().get_urls()
        custom_urls = [
            path(
                "<path:object_id>/preview/",
                self.admin_site.admin_view(self.preview_draft),
                name="portfolio_work_preview",
            ),
        ]
        return custom_urls + urls

    def preview_draft(self, request, object_id):
        obj = self.get_object(request, object_id)
        if obj is None:
            raise Http404("Obra não encontrada.")
        if not self.has_view_or_change_permission(request, obj):
            raise Http404("Obra não encontrada.")
        token = signing.dumps(
            {"work": obj.pk, "user": request.user.pk},
            salt="portfolio.work-preview",
        )
        return redirect(f"{reverse('frontend')}?preview_token={token}")

    @admin.display(description="Prévia privada")
    def preview_site(self, obj):
        if not obj or not obj.pk:
            return "Salve a obra para gerar uma prévia."
        return format_html(
            '<a class="button" href="{}" target="_blank" rel="noopener">'
            'Visualizar como ficará no site</a>',
            reverse("admin:portfolio_work_preview", args=[obj.pk]),
        )

    def get_queryset(self, request):
        return super().get_queryset(request).annotate(_imagens=Count("gallery_images", distinct=True))

    @admin.display(description="Imagem")
    def preview(self, obj):
        return miniatura(obj.image, obj.image_url)

    @admin.display(description="Fotos extras", ordering="_imagens")
    def total_imagens(self, obj):
        return obj._imagens

    def save_related(self, request, form, formsets, change):
        super().save_related(request, form, formsets, change)
        novas = form.cleaned_data.get("novas_imagens") or []
        if not novas:
            return
        posicao = proxima_posicao(form.instance.gallery_images)
        for arquivo in novas:
            WorkImage.objects.create(work=form.instance, image=arquivo, position=posicao)
            posicao += 1
        messages.info(request, f"{len(novas)} imagem(ns) adicionada(s) ao carrossel.")

    @admin.action(description="Publicar selecionadas")
    def publicar(self, request, queryset):
        self.message_user(request, f"{queryset.update(is_active=True)} obra(s) publicada(s).")

    @admin.action(description="Despublicar selecionadas (esconder sem apagar)")
    def despublicar(self, request, queryset):
        self.message_user(request, f"{queryset.update(is_active=False)} obra(s) despublicada(s).")


class WorkInline(admin.StackedInline):
    model = Work
    form = ImagemExistenteForm
    extra = 0
    fields = ("title", "image", "image_url", "description", "detail", "position", "is_active")
    show_change_link = True


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ("title", "key", "total_obras", "position", "is_active")
    list_display_links = ("title",)
    list_editable = ("position", "is_active")
    list_filter = ("is_active",)
    search_fields = ("title", "key")
    prepopulated_fields = {"key": ("title",)}
    list_per_page = 30
    save_on_top = True
    inlines = (WorkInline,)

    def get_queryset(self, request):
        return super().get_queryset(request).annotate(_total_obras=Count("works", distinct=True))

    @admin.display(description="Obras", ordering="_total_obras")
    def total_obras(self, obj):
        return obj._total_obras


@admin.register(WorkImage)
class WorkImageAdmin(admin.ModelAdmin):
    form = ImagemExistenteForm
    list_display = ("preview", "work", "position")
    list_display_links = ("preview", "work")
    list_editable = ("position",)
    list_filter = ("work__category",)
    list_select_related = ("work", "work__category")
    ordering = ("work__category__position", "work__position", "position", "id")
    search_fields = ("work__title",)
    list_per_page = 40

    @admin.display(description="Imagem")
    def preview(self, obj):
        return miniatura(obj.image)


# ---------------------------------------------------------------------------
# Referências
# ---------------------------------------------------------------------------

class ReferenceLinkInline(admin.TabularInline):
    model = ReferenceLink
    extra = 0
    fields = ("text", "url", "position")


@admin.register(Reference)
class ReferenceAdmin(admin.ModelAdmin):
    list_display = ("title", "period", "position", "is_active")
    list_display_links = ("title",)
    list_editable = ("position", "is_active")
    list_filter = ("is_active",)
    search_fields = ("title", "period")
    list_per_page = 30
    save_on_top = True
    inlines = (ReferenceLinkInline,)
