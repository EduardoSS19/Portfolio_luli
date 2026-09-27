from django.db import migrations


def seed_portfolio(apps, schema_editor):
    Category = apps.get_model("portfolio", "Category")
    Work = apps.get_model("portfolio", "Work")
    Reference = apps.get_model("portfolio", "Reference")
    ReferenceLink = apps.get_model("portfolio", "ReferenceLink")

    categories = [
        ("Cerâmica", "ceramica", [
            ("Vaso Terra", "/gaiola.jpg", "Peça em argila, queima alta.", "Técnica: torno + esmalte à base de cinza vegetal."),
            ("Tigela Azul", "/gaiola.jpg", "Esmalte reativo, torno manual.", "Cozida em forno a lenha, 1280°C."),
        ]),
        ("Glitch Art", "glitch", [
            ("Ruído 01", "/gaiola.jpg", "Distorção digital, RGB split.", "Databending feito em editor hexadecimal."),
            ("Fragmentado", "/gaiola.jpg", "Databending sobre foto analógica.", "Fotografia original de 2019, reprocessada."),
        ]),
        ("Gravura", "escultura", [
            ("Forma Suspensa", "/gaiola.jpg", "Argila e arame, 40cm.", "Estrutura interna em arame galvanizado."),
            ("Torção", "/gaiola.jpg", "Peça em gesso patinado.", "Patina feita com pigmento óxido."),
        ]),
        ("Desenho", "desenho", [
            ("Gaiola, 2023", "/gaiola.jpg", "Grafite sobre papel, A3.", "30 x 41 cm, desenho"),
            ("Estudo de Mãos", "/gaiola.jpg", "Nanquim, traço contínuo.", "Feito sem levantar a caneta do papel."),
        ]),
    ]

    for category_position, (category_title, category_key, works) in enumerate(categories):
        category = Category.objects.create(
            title=category_title,
            key=category_key,
            position=category_position,
        )
        Work.objects.bulk_create([
            Work(
                category=category,
                title=work_title,
                image_url=image_url,
                description=description,
                detail=detail,
                position=work_position,
            )
            for work_position, (work_title, image_url, description, detail) in enumerate(works)
        ])

    references = [
        (
            'Exposição "Bando de Barro Invade: 20 Anos"',
            "2024 – 2025",
            [
                ("Mostra apresenta obras de mais de 170 ceramistas — Correio do Povo", "https://www.correiodopovo.com.br/arteagenda/mostra-apresenta-obras-de-mais-de-170-ceramistas-1.1556799"),
                ("Quatro rotas para aproveitar a Noite dos Museus em Porto Alegre — Correio do Povo", "https://www.correiodopovo.com.br/arteagenda/quatro-rotas-para-aproveitar-a-noite-dos-museus-em-porto-alegre-1.1670880"),
                ('Centro Cultural da UFRGS inaugura mostra "Bando de Barro Invade: 20 anos" — Jornal do Comércio', "https://www.jornaldocomercio.com/cultura/2024/11/1181643-centro-cultural-da-ufrgs-inaugura-mostra-bando-de-barro-invade-20-anos.html"),
            ],
        ),
        (
            "PanAmerican — The International School of Porto Alegre",
            "2025 – atualmente",
            [("panamerican.com.br", "https://www.panamerican.com.br")],
        ),
    ]

    for reference_position, (reference_title, period, links) in enumerate(references):
        reference = Reference.objects.create(
            title=reference_title,
            period=period,
            position=reference_position,
        )
        ReferenceLink.objects.bulk_create([
            ReferenceLink(
                reference=reference,
                text=link_text,
                url=link_url,
                position=link_position,
            )
            for link_position, (link_text, link_url) in enumerate(links)
        ])


class Migration(migrations.Migration):
    dependencies = [("portfolio", "0001_initial")]

    operations = [migrations.RunPython(seed_portfolio, migrations.RunPython.noop)]