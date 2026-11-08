from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("portfolio", "0011_alter_workvideo_youtube_url")]

    operations = [
        migrations.AddField("work", "technique", models.CharField(blank=True, max_length=160, verbose_name="técnica")),
        migrations.AddField("work", "material", models.CharField(blank=True, max_length=160, verbose_name="material")),
        migrations.AddField("work", "support", models.CharField(blank=True, max_length=160, verbose_name="suporte")),
        migrations.AddField("work", "year", models.PositiveSmallIntegerField(blank=True, null=True, verbose_name="ano de criação")),
        migrations.AddField("work", "height", models.DecimalField(blank=True, decimal_places=2, max_digits=8, null=True, verbose_name="altura")),
        migrations.AddField("work", "width", models.DecimalField(blank=True, decimal_places=2, max_digits=8, null=True, verbose_name="largura")),
        migrations.AddField("work", "depth", models.DecimalField(blank=True, decimal_places=2, max_digits=8, null=True, verbose_name="profundidade")),
        migrations.AddField("work", "dimension_unit", models.CharField(blank=True, default="cm", max_length=12, verbose_name="unidade das dimensões")),
        migrations.AddField("work", "price", models.DecimalField(blank=True, decimal_places=2, max_digits=12, null=True, verbose_name="preço")),
        migrations.AddField("work", "currency", models.CharField(blank=True, default="BRL", max_length=3, verbose_name="moeda")),
        migrations.AddField("work", "availability", models.CharField(blank=True, choices=[("available", "Disponível"), ("sold", "Vendido"), ("reserved", "Reservado"), ("not_for_sale", "Não está à venda")], max_length=24, verbose_name="disponibilidade")),
        migrations.AddField("work", "series", models.CharField(blank=True, max_length=160, verbose_name="série ou coleção")),
        migrations.AddField("work", "edition", models.CharField(blank=True, max_length=80, verbose_name="edição")),
        migrations.AddField("work", "print_run", models.CharField(blank=True, max_length=80, verbose_name="tiragem")),
        migrations.AddField("work", "signed", models.BooleanField(blank=True, null=True, verbose_name="assinada")),
        migrations.AddField("work", "creation_location", models.CharField(blank=True, max_length=160, verbose_name="local de criação")),
        migrations.AddField("work", "condition", models.CharField(blank=True, max_length=160, verbose_name="estado de conservação")),
        migrations.AddField("work", "exhibitions", models.TextField(blank=True, verbose_name="exposições e contexto")),
        migrations.AlterField("work", "detail", models.TextField(blank=True, verbose_name="observações adicionais")),
    ]
