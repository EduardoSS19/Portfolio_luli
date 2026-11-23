from django.core.validators import RegexValidator
from django.db import models


class StudioTemplate(models.Model):
    slug = models.SlugField("identificador", max_length=60, unique=True)
    title = models.CharField("nome do modelo", max_length=100)
    kind = models.CharField("categoria", max_length=60, blank=True)
    description = models.TextField("descrição")
    presentation_mode = models.CharField("modo de apresentação", max_length=40)
    preview_shape = models.CharField(
        "forma da prévia", max_length=40, default="editorial",
        validators=[RegexValidator(r"^[a-z0-9-]+$", "Use apenas letras minúsculas, números e hífens.")],
    )
    tags = models.JSONField("características", default=list, blank=True)
    layout_config = models.JSONField("configuração inicial de layout", default=dict, blank=True)
    position = models.PositiveIntegerField("ordem", default=0)
    is_published = models.BooleanField("publicado no estúdio", default=False)
    created_at = models.DateTimeField("criado em", auto_now_add=True)
    updated_at = models.DateTimeField("atualizado em", auto_now=True)

    class Meta:
        ordering = ("position", "id")
        verbose_name = "modelo de experiência"
        verbose_name_plural = "modelos de experiência"

    def __str__(self):
        return self.title
