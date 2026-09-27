from django.db import migrations


def seed_portfolio(apps, schema_editor):
    Category = apps.get_model("portfolio", "Category")
    Work = apps.get_model("portfolio", "Work")

    categories = [
        ("Cerâmica", "ceramica"),
        ("Glitch Art", "glitch"),
        ("Gravura", "escultura"),
        ("Desenho", "desenho"),
    ]

    for category_position, (category_title, category_key) in enumerate(categories):
        category = Category.objects.create(
            title=category_title,
            key=category_key,
            position=category_position,
        )
        Work.objects.create(
            category=category,
            title="Obra de exemplo",
            description="Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
            detail="Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
            position=0,
        )


class Migration(migrations.Migration):
    dependencies = [("portfolio", "0001_initial")]

    operations = [migrations.RunPython(seed_portfolio, migrations.RunPython.noop)]