from django.db import migrations, models
import django.core.validators


class Migration(migrations.Migration):
    dependencies = [
        ("portfolio", "0014_revise_artist_bio"),
    ]

    operations = [
        migrations.CreateModel(
            name="SiteAppearance",
            fields=[
                ("id", models.PositiveSmallIntegerField(default=1, editable=False, primary_key=True, serialize=False)),
                ("background_start", models.CharField(default="#061522", max_length=7, validators=[django.core.validators.RegexValidator(message="Use uma cor hexadecimal no formato #RRGGBB.", regex="^#[0-9A-Fa-f]{6}$")], verbose_name="início do fundo")),
                ("background_middle", models.CharField(default="#0a233a", max_length=7, validators=[django.core.validators.RegexValidator(message="Use uma cor hexadecimal no formato #RRGGBB.", regex="^#[0-9A-Fa-f]{6}$")], verbose_name="meio do fundo")),
                ("background_end", models.CharField(default="#102f4c", max_length=7, validators=[django.core.validators.RegexValidator(message="Use uma cor hexadecimal no formato #RRGGBB.", regex="^#[0-9A-Fa-f]{6}$")], verbose_name="fim do fundo")),
                ("accent_color", models.CharField(default="#93c8f2", max_length=7, validators=[django.core.validators.RegexValidator(message="Use uma cor hexadecimal no formato #RRGGBB.", regex="^#[0-9A-Fa-f]{6}$")], verbose_name="cor de destaque")),
                ("text_color", models.CharField(default="#eff7ff", max_length=7, validators=[django.core.validators.RegexValidator(message="Use uma cor hexadecimal no formato #RRGGBB.", regex="^#[0-9A-Fa-f]{6}$")], verbose_name="cor principal dos textos")),
                ("border_color", models.CharField(default="#c3e1f9", max_length=7, validators=[django.core.validators.RegexValidator(message="Use uma cor hexadecimal no formato #RRGGBB.", regex="^#[0-9A-Fa-f]{6}$")], verbose_name="cor das linhas e bordas")),
                ("updated_at", models.DateTimeField(auto_now=True, verbose_name="última atualização")),
            ],
            options={
                "verbose_name": "aparência do site",
                "verbose_name_plural": "aparência do site",
            },
        ),
    ]
