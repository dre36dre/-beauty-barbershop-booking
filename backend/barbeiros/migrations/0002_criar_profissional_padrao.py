from django.db import migrations


def criar_profissional_padrao(apps, schema_editor):
    Barbeiro = apps.get_model('barbeiros', 'Barbeiro')
    banco = schema_editor.connection.alias

    if Barbeiro.objects.using(banco).filter(ativo=True).exists():
        return

    profissional, _ = Barbeiro.objects.using(banco).get_or_create(
        nome='Vanessa Souza',
        defaults={'ativo': True},
    )
    if not profissional.ativo:
        profissional.ativo = True
        profissional.save(using=banco, update_fields=['ativo'])


class Migration(migrations.Migration):
    dependencies = [
        ('agendamentos', '0004_importar_legado'),
    ]

    operations = [
        migrations.RunPython(criar_profissional_padrao, migrations.RunPython.noop),
    ]
