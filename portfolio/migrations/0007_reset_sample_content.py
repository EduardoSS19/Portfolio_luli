from django.db import migrations


def reset_sample_content(apps, schema_editor):
    Category = apps.get_model("portfolio", "Category")
    Work = apps.get_model("portfolio", "Work")
    Reference = apps.get_model("portfolio", "Reference")
    ArtistProfile = apps.get_model("portfolio", "ArtistProfile")

    sample_titles = {
        "Vaso Terra",
        "Tigela Azul",
        "Ruído 01",
        "Fragmentado",
        "Forma Suspensa",
        "Torção",
        "Gaiola, 2023",
        "Estudo de Mãos",
    }
    sample_references = {
        'Exposição "Bando de Barro Invade: 20 Anos"',
        "PanAmerican — The International School of Porto Alegre",
    }

    for category in Category.objects.all():
        samples = list(category.works.filter(title__in=sample_titles).order_by("position", "id"))
        if samples:
            work = samples[0]
            work.title = "Obra de exemplo"
            work.image = ""
            work.image_url = ""
            work.description = "Lorem ipsum dolor sit amet, consectetur adipiscing elit."
            work.detail = "Lorem ipsum dolor sit amet, consectetur adipiscing elit."
            work.position = 0
            work.save()
            for duplicate in samples[1:]:
                duplicate.delete()
        elif not category.works.exists():
            Work.objects.create(
                category=category,
                title="Obra de exemplo",
                description="Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
                detail="Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
                position=0,
            )

    Reference.objects.filter(title__in=sample_references).delete()

    profile = ArtistProfile.objects.filter(pk=1).first()
    if profile and not profile.tagline:
        profile.tagline = "Arte · Pesquisa · Experimentação"
        profile.save(update_fields=["tagline"])


class Migration(migrations.Migration):
    dependencies = [("portfolio", "0006_backgroundframe_artistprofile_contact_email_and_more")]

    operations = [migrations.RunPython(reset_sample_content, migrations.RunPython.noop)]