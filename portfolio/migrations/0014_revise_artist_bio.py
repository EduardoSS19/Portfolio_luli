from django.db import migrations


BIO_ANTERIOR = """Artista visual, educadora, formada técnica em informática, com graduação em Licenciatura em Artes Visuais em andamento, Luli Becker busca, em suas práticas, o ponto de convergência entre distintas técnicas artísticas, tecnológicas, lógicas e em discussões teóricas no desenvolvimento de seu trabalho. Busca sempre enxergar a arte e seu ensino com a importância da qual estes merecem ser vistos, pois, além da forma subjetiva de expressar suas ideias, também enfatiza a importância da compreensão das sensações nas relações interpessoais. Formada técnica em informática, procurou o ponto de convergência entre distintas técnicas artísticas, tecnologia, lógica e discussões teóricas, tanto no desenvolvimento de seu trabalho quanto na área de organização e catalogação. Fluente na língua inglesa, trabalha atualmente na PanAmerican - The International School of Porto Alegre."""


BIO_REVISADA = """Entre práticas artísticas, tecnologia e pensamento lógico, Luli Becker investiga possibilidades de encontro entre diferentes técnicas, processos de criação e discussões teóricas. Seu trabalho também se aproxima de práticas de organização e catalogação, explorando relações entre experimentação, método e linguagem.

Como educadora, compreende a arte e seu ensino como espaços de expressão, troca e atenção às sensações que atravessam as relações interpessoais. É técnica em Informática, cursa Licenciatura em Artes Visuais e é fluente em inglês. Atualmente, trabalha na PanAmerican – The International School of Porto Alegre."""


def revisar_biografia(apps, schema_editor):
    ArtistProfile = apps.get_model("portfolio", "ArtistProfile")
    anterior_normalizado = " ".join(BIO_ANTERIOR.split())

    perfil = ArtistProfile.objects.order_by("pk").first()
    if perfil and " ".join((perfil.bio or "").split()) == anterior_normalizado:
        perfil.bio = BIO_REVISADA
        perfil.save(update_fields=["bio"])


class Migration(migrations.Migration):
    dependencies = [("portfolio", "0013_work_is_share_image")]

    operations = [
        migrations.RunPython(revisar_biografia, migrations.RunPython.noop),
    ]
