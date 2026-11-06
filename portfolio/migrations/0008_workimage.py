import django.core.validators
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("portfolio", "0007_reset_sample_content"),
    ]

    operations = [
        migrations.CreateModel(
            name="WorkImage",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                (
                    "image",
                    models.ImageField(
                        upload_to="obras/%Y/%m/",
                        validators=[
                            django.core.validators.FileExtensionValidator(
                                ["jpg", "jpeg", "png", "webp"]
                            )
                        ],
                        verbose_name="imagem",
                    ),
                ),
                (
                    "position",
                    models.PositiveIntegerField(default=0, verbose_name="ordem"),
                ),
                (
                    "work",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="gallery_images",
                        to="portfolio.work",
                        verbose_name="obra",
                    ),
                ),
            ],
            options={
                "verbose_name": "imagem adicional da obra",
                "verbose_name_plural": "imagens adicionais das obras",
                "ordering": ("position", "id"),
            },
        ),
    ]
