from django.db import migrations


def seed_artist_profile(apps, schema_editor):
    ArtistProfile = apps.get_model("portfolio", "ArtistProfile")
    ArtistProfile.objects.get_or_create(
        pk=1,
        defaults={
            "name": "Luísa Becker",
            "photo_url": "/sobre/luisa.jpg",
            "bio": (
                "Luísa Becker sempre enxergou a arte e seu ensino com a importância da qual ela merece ser vista, pois além da forma subjetiva de expressar suas ideias, ela também enfatiza a importância da compreensão das sensações nas relações interpessoais.\n\n"
                "Formada técnica em informática, procurou o ponto de convergência entre distintas técnicas artísticas, tecnologia, lógica e discussões teóricas, tanto no desenvolvimento de seu trabalho quanto na área de organização e catalogação.\n\n"
                "Fluente na língua inglesa, trabalha atualmente na PanAmerican — The International School of Porto Alegre."
            ),
        },
    )


class Migration(migrations.Migration):
    dependencies = [("portfolio", "0004_artistprofile")]

    operations = [migrations.RunPython(seed_artist_profile, migrations.RunPython.noop)]