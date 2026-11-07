"""Apaga do Cloudinary (ou do disco) o arquivo antigo quando uma imagem é trocada
ou quando o item é excluído, para não acumular imagens órfãs."""

from django.db import transaction
from django.db.models import ImageField
from django.db.models.signals import post_delete, pre_save
from django.dispatch import receiver

from .models import ArtistProfile, BackgroundFrame, Work, WorkImage

MODELOS = (ArtistProfile, BackgroundFrame, Work, WorkImage)


def _campos_de_imagem(model):
    return [campo.name for campo in model._meta.get_fields() if isinstance(campo, ImageField)]


def _nomes_em_uso():
    nomes = set()
    for model in MODELOS:
        for campo in _campos_de_imagem(model):
            nomes.update(
                nome
                for nome in model.objects.exclude(**{campo: ""}).values_list(campo, flat=True)
                if nome
            )
    return nomes


def _apagar_se_orfao(arquivo):
    """Só apaga se nenhum outro registro ainda usa o mesmo arquivo."""
    if not arquivo or not arquivo.name:
        return
    storage, nome = arquivo.storage, arquivo.name

    def apagar():
        if nome in _nomes_em_uso():
            return
        try:
            storage.delete(nome)
        except Exception:  # limpeza nunca deve quebrar o salvamento
            pass

    transaction.on_commit(apagar)


@receiver(pre_save)
def apagar_imagem_substituida(sender, instance, **kwargs):
    if sender not in MODELOS or not instance.pk:
        return
    try:
        antigo = sender.objects.get(pk=instance.pk)
    except sender.DoesNotExist:
        return
    for campo in _campos_de_imagem(sender):
        arquivo_antigo = getattr(antigo, campo)
        arquivo_novo = getattr(instance, campo)
        if arquivo_antigo and arquivo_antigo.name != (arquivo_novo.name if arquivo_novo else ""):
            _apagar_se_orfao(arquivo_antigo)


@receiver(post_delete)
def apagar_imagem_excluida(sender, instance, **kwargs):
    if sender not in MODELOS:
        return
    for campo in _campos_de_imagem(sender):
        _apagar_se_orfao(getattr(instance, campo))
