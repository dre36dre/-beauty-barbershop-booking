from django.db import migrations, models
import django.db.models.deletion

class Migration(migrations.Migration):
    dependencies = [
        ('agendamentos', '0002_remove_agendamento_servico_agendamento_duracao_total_and_more'),
        ('clientes', '0001_initial'), ('barbeiros', '0001_initial'), ('servicos', '0001_initial'),
    ]
    operations = [
        migrations.AddField(model_name='agendamento', name='cliente', field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name='agendamentos', to='clientes.cliente')),
        migrations.AddField(model_name='agendamento', name='profissional', field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name='reservas', to='barbeiros.barbeiro')),
        migrations.CreateModel(name='AgendamentoServico', fields=[
            ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
            ('preco_contratado', models.DecimalField(decimal_places=2, max_digits=8)),
            ('duracao_contratada', models.PositiveIntegerField()),
            ('agendamento', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='itens_contratados', to='agendamentos.agendamento')),
            ('servico', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, to='servicos.serviços')),
        ], options={'constraints':[models.UniqueConstraint(fields=('agendamento','servico'),name='unique_servico_agendamento')]}),
        migrations.AddField(model_name='agendamento', name='itens', field=models.ManyToManyField(blank=True, related_name='reservas', through='agendamentos.AgendamentoServico', to='servicos.serviços')),
    ]
