from django.db import models
from django.core.validators import FileExtensionValidator


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
    detail = models.TextField("detalhes", blank=True)
    position = models.PositiveIntegerField("ordem", default=0)
    is_active = models.BooleanField("publicada", default=True)

    class Meta:
        ordering = ("position", "id")
        verbose_name = "obra"
        verbose_name_plural = "obras"

    def __str__(self):
        return self.title


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