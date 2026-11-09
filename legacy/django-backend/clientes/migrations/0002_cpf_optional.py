from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('clientes', '0001_initial'),
    ]

    operations = [
        migrations.AlterField(
            model_name='cliente',
            name='cpf',
            field=models.CharField(blank=True, max_length=11, null=True, unique=True),
        ),
    ]
