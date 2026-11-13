from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("portfolio", "0016_artistprofile_brand_background_color")]

    operations = [
        migrations.AddField(
            model_name="artistprofile",
            name="layout_settings",
            field=models.JSONField(blank=True, default=dict, verbose_name="configurações de layout"),
        ),
    ]
