import os

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError


class Command(BaseCommand):
    def handle(self, *args, **options):
        username = os.environ.get("DJANGO_SUPERUSER_USERNAME", "admin")
        user_model = get_user_model()

        if user_model.objects.filter(username=username).exists():
            return

        password = os.environ.get("DJANGO_SUPERUSER_PASSWORD")
        if not password:
            raise CommandError("DJANGO_SUPERUSER_PASSWORD precisa ser definida no primeiro start.")

        user_model.objects.create_superuser(
            username=username,
            email=os.environ.get("DJANGO_SUPERUSER_EMAIL", ""),
            password=password,
        )