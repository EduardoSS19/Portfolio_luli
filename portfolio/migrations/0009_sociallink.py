from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("portfolio", "0008_workimage"),
    ]

    operations = [
        migrations.CreateModel(
            name="SocialLink",
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
                ("title", models.CharField(max_length=40, verbose_name="rede social")),
                ("url", models.URLField(max_length=500, verbose_name="URL")),
                (
                    "position",
                    models.PositiveIntegerField(default=0, verbose_name="ordem"),
                ),
                (
                    "is_active",
                    models.BooleanField(default=True, verbose_name="publicado"),
                ),
            ],
            options={
                "verbose_name": "link de rede social",
                "verbose_name_plural": "links de redes sociais",
                "ordering": ("position", "id"),
            },
        ),
    ]
