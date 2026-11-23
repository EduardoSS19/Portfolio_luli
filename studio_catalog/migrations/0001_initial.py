from django.db import migrations, models


def seed_templates(apps, schema_editor):
    StudioTemplate = apps.get_model("studio_catalog", "StudioTemplate")
    templates = [
        ("editorial", "Editorial", "Narrativa", "Uma composição tipográfica e arejada, feita para trabalhos que pedem contexto, ritmo e leitura.", "editorial", ["Tipografia", "Respiro", "Texto + imagem"]),
        ("immersive", "Imersivo", "Atmosfera", "Imagem, escala e presença conduzem a experiência. Para projetos em que o universo visual fala primeiro.", "immersive", ["Imagem", "Atmosfera", "Impacto"]),
        ("masonry", "Mosaico", "Composição", "Um campo visual dinâmico para coleções, séries e portfólios com obras de formatos diferentes.", "masonry", ["Grade variável", "Coleções", "Ritmo"]),
        ("timeline", "Linha do tempo", "Percurso", "Processos, projetos e trajetórias organizados como uma história que se desenrola.", "timeline", ["Sequência", "Processo", "Contexto"]),
        ("brutalist", "Brutalista", "Expressão", "Contraste, tipografia incisiva e estrutura assumida. Uma presença digital sem neutralidade.", "brutalist", ["Contraste", "Tipografia", "Atitude"]),
        ("cinematic", "Cinemático", "Movimento", "Uma apresentação guiada por imagens, pausas e transições para projetos que pedem sequência.", "cinematic", ["Sequência", "Movimento", "Imersão"]),
        ("museum", "Museu", "Acervo", "Uma organização cuidadosa para obras, séries, informações e referências que merecem permanência.", "museum", ["Acervo", "Detalhes", "Curadoria"]),
        ("tattoo-book", "Caderno de flashes", "Especializado", "Uma linguagem dedicada a tatuadores: desenhos, disponibilidade, informações e contato.", "tattoo-book", ["Flashes", "Disponibilidade", "Agenda"]),
    ]
    for position, (slug, title, kind, description, mode, tags) in enumerate(templates):
        StudioTemplate.objects.get_or_create(
            slug=slug,
            defaults={
                "title": title,
                "kind": kind,
                "description": description,
                "presentation_mode": mode,
                "preview_shape": slug,
                "tags": tags,
                "position": position,
                "is_published": True,
            },
        )


class Migration(migrations.Migration):
    initial = True
    dependencies = []
    operations = [
        migrations.CreateModel(
            name="StudioTemplate",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("slug", models.SlugField(max_length=60, unique=True, verbose_name="identificador")),
                ("title", models.CharField(max_length=100, verbose_name="nome do modelo")),
                ("kind", models.CharField(blank=True, max_length=60, verbose_name="categoria")),
                ("description", models.TextField(verbose_name="descrição")),
                ("presentation_mode", models.CharField(max_length=40, verbose_name="modo de apresentação")),
                ("preview_shape", models.CharField(default="editorial", max_length=40, validators=[models.RegexValidator(r"^[a-z0-9-]+$", "Use apenas letras minúsculas, números e hífens.")], verbose_name="forma da prévia")),
                ("tags", models.JSONField(blank=True, default=list, verbose_name="características")),
                ("layout_config", models.JSONField(blank=True, default=dict, verbose_name="configuração inicial de layout")),
                ("position", models.PositiveIntegerField(default=0, verbose_name="ordem")),
                ("is_published", models.BooleanField(default=False, verbose_name="publicado no estúdio")),
                ("created_at", models.DateTimeField(auto_now_add=True, verbose_name="criado em")),
                ("updated_at", models.DateTimeField(auto_now=True, verbose_name="atualizado em")),
            ],
            options={"verbose_name": "modelo de experiência", "verbose_name_plural": "modelos de experiência", "ordering": ("position", "id")},
        ),
        migrations.RunPython(seed_templates, migrations.RunPython.noop),
    ]
