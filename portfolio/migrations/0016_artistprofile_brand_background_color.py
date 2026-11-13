from django.db import migrations, models
import django.core.validators


class Migration(migrations.Migration):
    dependencies = [("portfolio", "0015_artistprofile_brand_image")]

    operations = [
        migrations.AddField(
            model_name="artistprofile",
            name="brand_background_color",
            field=models.CharField(
                default="#151612",
                max_length=7,
                validators=[django.core.validators.RegexValidator(
                    regex=r"^#[0-9A-Fa-f]{6}$",
                    message="Informe uma cor hexadecimal no formato #RRGGBB.",
                )],
                verbose_name="cor de fundo da marca",
            ),
        ),
    ]
