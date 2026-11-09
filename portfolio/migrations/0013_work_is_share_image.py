from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("portfolio", "0012_work_technical_metadata")]

    operations = [
        migrations.AddField(
            model_name="work",
            name="is_share_image",
            field=models.BooleanField(
                default=False,
                help_text="Esta obra será a imagem exibida quando o site for compartilhado no WhatsApp e nas redes sociais. Apenas uma obra pode ficar selecionada.",
                verbose_name="usar como imagem de compartilhamento",
            ),
        ),
    ]
