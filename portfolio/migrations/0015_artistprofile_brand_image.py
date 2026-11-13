from django.db import migrations, models
import django.core.validators


class Migration(migrations.Migration):
    dependencies = [("portfolio", "0014_revise_artist_bio")]

    operations = [
        migrations.AddField(
            model_name="artistprofile",
            name="brand_image",
            field=models.ImageField(blank=True, upload_to="identidade/%Y/%m/", validators=[django.core.validators.FileExtensionValidator(["jpg", "jpeg", "png", "webp"])], verbose_name="imagem da marca"),
        ),
    ]
