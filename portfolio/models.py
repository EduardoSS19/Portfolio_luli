from django.db import models


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
    image_url = models.CharField("URL ou caminho da imagem", max_length=500, blank=True)
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