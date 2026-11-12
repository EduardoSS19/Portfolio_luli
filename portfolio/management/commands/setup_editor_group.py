from django.contrib.auth.models import Group, Permission
from django.db.models import Q
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Cria/atualiza o grupo de editores do portfólio sem permissões de exclusão."

    def handle(self, *args, **options):
        group, created = Group.objects.get_or_create(name="Editores do portfólio")
        permissions = Permission.objects.filter(
            content_type__app_label="portfolio",
        ).filter(
            Q(codename__regex=r"^(add|change|view)_") | Q(codename="delete_work")
        )
        group.permissions.set(permissions)
        action = "criado" if created else "atualizado"
        self.stdout.write(
            self.style.SUCCESS(
                f"Grupo {action}: {group.name} ({permissions.count()} permissões)."
            )
        )
