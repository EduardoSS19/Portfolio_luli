from django.db import migrations, models
import django.core.validators


class Migration(migrations.Migration):
    dependencies = [("portfolio", "0014_revise_artist_bio")]

    operations = [
        migrations.CreateModel(
            name="SiteAppearance",
            fields=[
                ("id", models.PositiveSmallIntegerField(default=1, editable=False, primary_key=True, serialize=False)),
                ("accent", models.CharField(default="#93C8F2", help_text="Links, botões, detalhes e elementos em evidência.", max_length=7, validators=[django.core.validators.RegexValidator(r"^#[0-9A-Fa-f]{6}$", "Use uma cor hexadecimal no formato #RRGGBB.")] , verbose_name="cor de destaque")),
                ("background", models.CharField(default="#061522", max_length=7, validators=[django.core.validators.RegexValidator(r"^#[0-9A-Fa-f]{6}$", "Use uma cor hexadecimal no formato #RRGGBB.")], verbose_name="fundo principal")),
                ("background_alt", models.CharField(default="#102F4C", max_length=7, validators=[django.core.validators.RegexValidator(r"^#[0-9A-Fa-f]{6}$", "Use uma cor hexadecimal no formato #RRGGBB.")], verbose_name="fundo secundário")),
                ("surface", models.CharField(default="#0B2943", max_length=7, validators=[django.core.validators.RegexValidator(r"^#[0-9A-Fa-f]{6}$", "Use uma cor hexadecimal no formato #RRGGBB.")], verbose_name="superfícies e cartões")),
                ("text", models.CharField(default="#EFF7FF", max_length=7, validators=[django.core.validators.RegexValidator(r"^#[0-9A-Fa-f]{6}$", "Use uma cor hexadecimal no formato #RRGGBB.")], verbose_name="texto principal")),
                ("border", models.CharField(default="#93C8F2", help_text="A intensidade é suavizada automaticamente para manter a delicadeza das linhas.", max_length=7, validators=[django.core.validators.RegexValidator(r"^#[0-9A-Fa-f]{6}$", "Use uma cor hexadecimal no formato #RRGGBB.")], verbose_name="bordas e divisórias")),
            ],
            options={"verbose_name": "identidade visual", "verbose_name_plural": "identidade visual"},
        ),
    ]
