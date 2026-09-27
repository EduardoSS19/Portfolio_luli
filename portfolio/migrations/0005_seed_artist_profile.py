from django.db import migrations


def seed_artist_profile(apps, schema_editor):
    ArtistProfile = apps.get_model("portfolio", "ArtistProfile")
    ArtistProfile.objects.get_or_create(
        pk=1,
        defaults={
            "name": "Nome da artista",
            "photo_url": "",
            "bio": "Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
        },
    )


class Migration(migrations.Migration):
    dependencies = [("portfolio", "0004_artistprofile")]

    operations = [migrations.RunPython(seed_artist_profile, migrations.RunPython.noop)]