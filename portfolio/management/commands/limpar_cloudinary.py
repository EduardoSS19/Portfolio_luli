from datetime import datetime, timedelta, timezone

from django.core.management.base import BaseCommand, CommandError
from django.db.models import ImageField

from portfolio.models import ArtistProfile, BackgroundFrame, Work, WorkImage

PASTAS = ("obras/", "fundos/", "sobre/")


class Command(BaseCommand):
    help = (
        "Lista (e, com --apagar, exclui) as imagens do Cloudinary que nenhum registro do "
        "banco usa mais. Por padrão só MOSTRA o que seria apagado."
    )

    def add_arguments(self, parser):
        parser.add_argument("--apagar", action="store_true", help="Apaga de verdade.")
        parser.add_argument(
            "--idade-minima-horas",
            type=int,
            default=24,
            help="Ignora imagens enviadas há menos que isso (padrão: 24h).",
        )

    def handle(self, *args, **options):
        try:
            import cloudinary
            import cloudinary.api
            import cloudinary_storage.storage  # noqa: F401  (configura as credenciais)
        except ImportError as error:
            raise CommandError("Cloudinary não está instalado.") from error

        usados = set()
        textos = []
        for model in (ArtistProfile, BackgroundFrame, Work, WorkImage):
            for campo in model._meta.get_fields():
                if isinstance(campo, ImageField):
                    for nome in model.objects.exclude(**{campo.name: ""}).values_list(campo.name, flat=True):
                        if nome:
                            usados.add(nome.rsplit(".", 1)[0])
        textos.extend(Work.objects.exclude(image_url="").values_list("image_url", flat=True))
        textos.extend(ArtistProfile.objects.exclude(photo_url="").values_list("photo_url", flat=True))

        limite = datetime.now(timezone.utc) - timedelta(hours=options["idade_minima_horas"])
        orfas, mantidas, ignoradas = [], 0, 0
        cursor = None
        while True:
            resposta = cloudinary.api.resources(
                type="upload", resource_type="image", max_results=500, next_cursor=cursor
            )
            for recurso in resposta.get("resources", []):
                public_id = recurso["public_id"]
                if not any(pasta in public_id for pasta in PASTAS):
                    continue  # nunca mexe no que não foi enviado pelo painel
                if any(public_id == u or public_id.endswith("/" + u) or u.endswith(public_id) for u in usados):
                    mantidas += 1
                    continue
                if any(public_id in texto for texto in textos):
                    mantidas += 1
                    continue
                criado = datetime.fromisoformat(recurso["created_at"].replace("Z", "+00:00"))
                if criado > limite:
                    ignoradas += 1
                    continue
                orfas.append(public_id)
            cursor = resposta.get("next_cursor")
            if not cursor:
                break

        self.stdout.write(f"Em uso: {mantidas} | Recentes (ignoradas): {ignoradas} | Órfãs: {len(orfas)}")
        for public_id in orfas:
            self.stdout.write(f"  órfã: {public_id}")

        if not orfas:
            return
        if not options["apagar"]:
            self.stdout.write(self.style.WARNING("Nada foi apagado. Rode com --apagar para excluir."))
            return

        for i in range(0, len(orfas), 100):
            cloudinary.api.delete_resources(orfas[i : i + 100], resource_type="image", type="upload")
        self.stdout.write(self.style.SUCCESS(f"{len(orfas)} imagem(ns) apagada(s)."))
