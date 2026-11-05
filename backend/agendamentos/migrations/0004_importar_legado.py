from django.db import migrations

def copiar(apps, schema_editor):
    AntigoBarbeiro = apps.get_model('agendamentos', 'Barbeiro')
    AntigoServico = apps.get_model('agendamentos', 'Servico')
    Agendamento = apps.get_model('agendamentos', 'Agendamento')
    NovoBarbeiro = apps.get_model('barbeiros', 'Barbeiro')
    NovoServico = apps.get_model('servicos', 'Serviços')
    Item = apps.get_model('agendamentos', 'AgendamentoServico')
    db = schema_editor.connection.alias
    mapa_b = {}
    for antigo in AntigoBarbeiro.objects.using(db).all():
        novo = NovoBarbeiro.objects.using(db).filter(nome=antigo.nome).first()
        if novo is None:
            novo = NovoBarbeiro.objects.using(db).create(nome=antigo.nome, ativo=antigo.ativo)
        mapa_b[antigo.pk] = novo.pk
    mapa_s = {}
    for antigo in AntigoServico.objects.using(db).all():
        novo = NovoServico.objects.using(db).filter(nome=antigo.nome, preco=antigo.preco, duracao=antigo.duracao).first()
        if novo is None:
            novo = NovoServico.objects.using(db).create(nome=antigo.nome, descricao=antigo.descricao, preco=antigo.preco, duracao=antigo.duracao, ativo=antigo.ativo)
        mapa_s[antigo.pk] = novo.pk
    for agenda in Agendamento.objects.using(db).all():
        agenda.profissional_id = mapa_b.get(agenda.barbeiro_id)
        agenda.save(using=db, update_fields=['profissional'])
        # M2M histórico original (agendamentos.servico)
        for antigo in agenda.servicos.all():
            novo_id = mapa_s[antigo.pk]
            Item.objects.using(db).get_or_create(agendamento_id=agenda.pk, servico_id=novo_id, defaults={'preco_contratado':antigo.preco,'duracao_contratada':antigo.duracao})
        itens = Item.objects.using(db).filter(agendamento_id=agenda.pk)
        agenda.valor_total = sum((i.preco_contratado for i in itens), 0)
        agenda.duracao_total = sum((i.duracao_contratada for i in itens), 0)
        agenda.save(using=db, update_fields=['valor_total','duracao_total'])

class Migration(migrations.Migration):
    dependencies = [('agendamentos', '0003_integracao')]
    operations = [migrations.RunPython(copiar, migrations.RunPython.noop)]
