from django.db import migrations, models


def preserve_existing_category_animations(apps, schema_editor):
    Category = apps.get_model("portfolio", "Category")
    aliases = {
        "ceram": "ceramica",
        "gravura": "gravura",
        "escultura": "gravura",
        "desenho": "desenho",
        "glitch": "glitch",
        "fotograf": "fotografia",
        "video": "videoarte",
    }
    for category in Category.objects.all().iterator():
        label = f"{category.title} {category.key}".casefold()
        animation = "obra"
        for token, preset in aliases.items():
            if token in label:
                animation = preset
                break
        Category.objects.filter(pk=category.pk).update(animation=animation)


class Migration(migrations.Migration):
    dependencies = [
        ("portfolio", "0017_artistprofile_layout_settings"),
    ]

    operations = [
        migrations.AddField(
            model_name="category",
            name="animation",
            field=models.CharField(
                choices=[
                    ("obra", "Editorial"),
                    ("ceramica", "Cerâmica"),
                    ("gravura", "Gravura"),
                    ("desenho", "Desenho"),
                    ("glitch", "Glitch"),
                    ("fotografia", "Fotografia"),
                    ("videoarte", "Videoarte"),
                    ("suave", "Aparição suave"),
                    ("deslizar", "Deslizar"),
                    ("zoom", "Zoom"),
                    ("recorte", "Revelação por recorte"),
                    ("flutuar", "Flutuação"),
                    ("nenhuma", "Sem animação"),
                ],
                default="obra",
                max_length=20,
                verbose_name="animação",
            ),
        ),
        migrations.RunPython(preserve_existing_category_animations, migrations.RunPython.noop),
    ]
