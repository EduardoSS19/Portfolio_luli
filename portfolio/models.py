from django.db import models
from django.core.validators import FileExtensionValidator, RegexValidator


class ArtistProfile(models.Model):
    id = models.PositiveSmallIntegerField(primary_key=True, default=1, editable=False)
    name = models.CharField("nome", max_length=120)
    tagline = models.CharField("frase de apresentação", max_length=255, blank=True)
    photo = models.ImageField(
        "foto enviada",
        upload_to="sobre/%Y/%m/",
        blank=True,
        validators=[FileExtensionValidator(["jpg", "jpeg", "png", "webp"])],
    )
    photo_url = models.CharField("URL alternativa da foto", max_length=500, blank=True)
    bio = models.TextField("biografia (separe os parágrafos com linha em branco)")
    instagram_url = models.URLField("Instagram", max_length=500, blank=True)
    contact_email = models.EmailField("e-mail de contato", blank=True)
    contact_form_url = models.URLField("endpoint do formulário", max_length=500, blank=True)

    class Meta:
        verbose_name = "perfil do portfólio"
        verbose_name_plural = "perfil do portfólio"

    def __str__(self):
        return self.name


class SocialLink(models.Model):
    title = models.CharField("rede social", max_length=40)
    url = models.URLField("URL", max_length=500)
    position = models.PositiveIntegerField("ordem", default=0)
    is_active = models.BooleanField("publicado", default=True)

    class Meta:
        ordering = ("position", "id")
        verbose_name = "link de rede social"
        verbose_name_plural = "links de redes sociais"

    def __str__(self):
        return self.title


class BackgroundFrame(models.Model):
    image = models.ImageField(
        "imagem enviada",
        upload_to="fundos/%Y/%m/",
        validators=[FileExtensionValidator(["jpg", "jpeg", "png", "webp"])],
    )
    position = models.PositiveIntegerField("ordem", default=0)
    is_active = models.BooleanField("publicado", default=True)

    class Meta:
        ordering = ("position", "id")
        verbose_name = "imagem de fundo"
        verbose_name_plural = "imagens de fundo"

    def __str__(self):
        return f"Imagem de fundo {self.position + 1}"


class Category(models.Model):
    title = models.CharField("título", max_length=100)
    key = models.SlugField("chave", max_length=50, unique=True)
    position = models.PositiveIntegerField("ordem", default=0)
    is_active = models.BooleanField("publicada", default=True)

    class Meta:
        ordering = ("position", "id")
        verbose_name = "categoria"
        verbose_name_plural = "categorias"

    def __str__(self):
        return self.title


class Work(models.Model):
    category = models.ForeignKey(
        Category,
        on_delete=models.CASCADE,
        related_name="works",
        verbose_name="categoria",
    )
    title = models.CharField("título", max_length=150)
    image = models.ImageField(
        "imagem enviada",
        upload_to="obras/%Y/%m/",
        blank=True,
        validators=[FileExtensionValidator(["jpg", "jpeg", "png", "webp"])],
    )
    image_url = models.CharField("URL alternativa da imagem", max_length=500, blank=True)
    description = models.TextField("descrição", blank=True)
    detail = models.TextField("observações adicionais", blank=True)
    technique = models.CharField("técnica", max_length=160, blank=True)
    material = models.CharField("material", max_length=160, blank=True)
    support = models.CharField("suporte", max_length=160, blank=True)
    year = models.PositiveSmallIntegerField("ano de criação", null=True, blank=True)
    height = models.DecimalField("altura", max_digits=8, decimal_places=2, null=True, blank=True)
    width = models.DecimalField("largura", max_digits=8, decimal_places=2, null=True, blank=True)
    depth = models.DecimalField("profundidade", max_digits=8, decimal_places=2, null=True, blank=True)
    dimension_unit = models.CharField("unidade das dimensões", max_length=12, blank=True, default="cm")
    price = models.DecimalField("preço", max_digits=12, decimal_places=2, null=True, blank=True)
    currency = models.CharField("moeda", max_length=3, blank=True, default="BRL")
    availability = models.CharField(
        "disponibilidade", max_length=24, blank=True,
        choices=(("available", "Disponível"), ("sold", "Vendido"), ("reserved", "Reservado"), ("not_for_sale", "Não está à venda")),
    )
    series = models.CharField("série ou coleção", max_length=160, blank=True)
    edition = models.CharField("edição", max_length=80, blank=True)
    print_run = models.CharField("tiragem", max_length=80, blank=True)
    signed = models.BooleanField("assinada", null=True, blank=True)
    creation_location = models.CharField("local de criação", max_length=160, blank=True)
    condition = models.CharField("estado de conservação", max_length=160, blank=True)
    exhibitions = models.TextField("exposições e contexto", blank=True)
    position = models.PositiveIntegerField("ordem", default=0)
    is_active = models.BooleanField("publicada", default=True)
    is_share_image = models.BooleanField(
        "usar como imagem de compartilhamento",
        default=False,
        help_text="Esta obra será a imagem exibida quando o site for compartilhado no WhatsApp e nas redes sociais. Apenas uma obra pode ficar selecionada.",
    )

    class Meta:
        ordering = ("position", "id")
        verbose_name = "obra"
        verbose_name_plural = "obras"

    def __str__(self):
        return self.title


class WorkImage(models.Model):
    work = models.ForeignKey(
        Work,
        on_delete=models.CASCADE,
        related_name="gallery_images",
        verbose_name="obra",
    )
    image = models.ImageField(
        "imagem",
        upload_to="obras/%Y/%m/",
        validators=[FileExtensionValidator(["jpg", "jpeg", "png", "webp"])],
    )
    position = models.PositiveIntegerField("ordem", default=0)

    class Meta:
        ordering = ("position", "id")
        verbose_name = "imagem adicional da obra"
        verbose_name_plural = "imagens adicionais das obras"

    def __str__(self):
        return f"{self.work} — imagem {self.position + 1}"


class WorkVideo(models.Model):
    work = models.ForeignKey(
        Work,
        on_delete=models.CASCADE,
        related_name="youtube_videos",
        verbose_name="obra",
    )
    youtube_url = models.URLField(
        "link do YouTube",
        max_length=500,
        help_text="Cole o link do vídeo. O título e a miniatura serão buscados pela YouTube Data API.",
    )
    video_id = models.CharField("ID do vídeo", max_length=11, editable=False)
    video_title = models.CharField("título no YouTube", max_length=255, editable=False)
    thumbnail_url = models.URLField("miniatura do YouTube", max_length=500, editable=False)
    position = models.PositiveIntegerField("ordem", default=0)

    class Meta:
        ordering = ("position", "id")
        verbose_name = "vídeo do YouTube"
        verbose_name_plural = "vídeos do YouTube"

    def __str__(self):
        return f"{self.work} — vídeo {self.position + 1}"


class Reference(models.Model):
    title = models.CharField("título", max_length=255)
    period = models.CharField("período", max_length=100, blank=True)
    position = models.PositiveIntegerField("ordem", default=0)
    is_active = models.BooleanField("publicada", default=True)

    class Meta:
        ordering = ("position", "id")
        verbose_name = "referência"
        verbose_name_plural = "referências"

    def __str__(self):
        return self.title


class ReferenceLink(models.Model):
    reference = models.ForeignKey(
        Reference,
        on_delete=models.CASCADE,
        related_name="links",
        verbose_name="referência",
    )
    text = models.CharField("texto", max_length=255)
    url = models.URLField("URL", max_length=500)
    position = models.PositiveIntegerField("ordem", default=0)

    class Meta:
        ordering = ("position", "id")
        verbose_name = "link"
        verbose_name_plural = "links"

    def __str__(self):
        return self.text

class SiteAppearance(models.Model):
    """Identidade visual única, compartilhada pelo site público e pelo painel."""

    id = models.PositiveSmallIntegerField(primary_key=True, default=1, editable=False)
    accent = models.CharField(
        "cor de destaque", max_length=7, default="#93C8F2",
        validators=[RegexValidator(r"^#[0-9A-Fa-f]{6}$", "Use uma cor hexadecimal no formato #RRGGBB.")],
        help_text="Links, botões, detalhes e elementos em evidência.",
    )
    background = models.CharField(
        "fundo principal", max_length=7, default="#061522",
        validators=[RegexValidator(r"^#[0-9A-Fa-f]{6}$", "Use uma cor hexadecimal no formato #RRGGBB.")],
    )
    background_alt = models.CharField(
        "fundo secundário", max_length=7, default="#102F4C",
        validators=[RegexValidator(r"^#[0-9A-Fa-f]{6}$", "Use uma cor hexadecimal no formato #RRGGBB.")],
    )
    surface = models.CharField(
        "superfícies e cartões", max_length=7, default="#0B2943",
        validators=[RegexValidator(r"^#[0-9A-Fa-f]{6}$", "Use uma cor hexadecimal no formato #RRGGBB.")],
    )
    text = models.CharField(
        "texto principal", max_length=7, default="#EFF7FF",
        validators=[RegexValidator(r"^#[0-9A-Fa-f]{6}$", "Use uma cor hexadecimal no formato #RRGGBB.")],
    )
    border = models.CharField(
        "bordas e divisórias", max_length=7, default="#93C8F2",
        validators=[RegexValidator(r"^#[0-9A-Fa-f]{6}$", "Use uma cor hexadecimal no formato #RRGGBB.")],
        help_text="A intensidade é suavizada automaticamente para manter a delicadeza das linhas.",
    )

    class Meta:
        verbose_name = "identidade visual"
        verbose_name_plural = "identidade visual"

    def __str__(self):
        return "Identidade visual do portfólio"

    @classmethod
    def get_solo(cls):
        appearance, _ = cls.objects.get_or_create(pk=1)
        return appearance

    def save(self, *args, **kwargs):
        self.pk = 1
        # objects.create() usa force_insert=True; o singleton deve atualizar a
        # linha única existente em vez de tentar inserir uma segunda.
        kwargs.pop("force_insert", None)
        if type(self).objects.filter(pk=1).exists():
            kwargs["force_update"] = True
        super().save(*args, **kwargs)
