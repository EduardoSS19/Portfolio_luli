from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("portfolio", "0018_category_animation"),
    ]

    operations = [
        migrations.AlterField(
            model_name="category",
            name="animation",
            field=models.CharField(
                choices=[
                    ("obra", "Entrada editorial"),
                    ("ceramica", "Modelagem no torno"),
                    ("gravura", "Impressão na prensa"),
                    ("desenho", "Traço revelado"),
                    ("glitch", "Glitch"),
                    ("fotografia", "Abertura de íris"),
                    ("videoarte", "Varredura de tela"),
                    ("suave", "Dissolver"),
                    ("deslizar", "Subir suavemente"),
                    ("zoom", "Aproximar"),
                    ("recorte", "Abrir em cortina"),
                    ("flutuar", "Flutuar"),
                    ("nenhuma", "Sem animação"),
                ],
                default="obra",
                max_length=20,
                verbose_name="animação",
            ),
        ),
    ]
