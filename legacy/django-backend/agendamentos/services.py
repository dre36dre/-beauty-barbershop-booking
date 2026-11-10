from datetime import datetime, time, timedelta
from decimal import Decimal
from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone
from barbeiros.models import Barbeiro
from servicos.models import Servicos
from .models import Agendamento, AgendamentoServico

PASSO_MINUTOS = 15
HORARIOS_FUNCIONAMENTO = {
    1: (time(10), time(18)),      # Terça-feira
    2: (time(10), time(18, 30)),  # Quarta-feira
    3: (time(10), time(18, 30)),  # Quinta-feira
    4: (time(10), time(18, 30)),  # Sexta-feira
    5: (time(10), time(18)),      # Sábado
}

def escolher_servicos(ids):
    if not isinstance(ids, list) or not ids or len(ids) != len(set(map(str, ids))):
        raise ValidationError('Selecione serviços distintos.')
    servicos = list(Servicos.objects.filter(id__in=ids, ativo=True))
    if len(servicos) != len(ids):
        raise ValidationError('Há serviços inválidos ou inativos.')
    if any(s.duracao <= 0 for s in servicos):
        raise ValidationError('Serviço com duração inválida.')
    return servicos

def totais(servicos):
    return sum((s.preco for s in servicos), Decimal('0.00')), sum(s.duracao for s in servicos)

def periodos_livres(barbeiro, dia, duracao):
    if not barbeiro.ativo or duracao <= 0 or dia < timezone.localdate():
        return []
    horario_abertura = HORARIOS_FUNCIONAMENTO.get(dia.weekday())
    if horario_abertura is None:
        return []

    abre, fecha = horario_abertura
    ocupados = []
    for a in Agendamento.objects.filter(profissional=barbeiro, data=dia, status='agendado'):
        if a.duracao_total:
            inicio = timezone.make_aware(datetime.combine(dia, a.horario), timezone.get_current_timezone())
            ocupados.append((inicio, inicio + timedelta(minutes=a.duracao_total)))
    agora = timezone.now()
    horarios = set()
    inicio = timezone.make_aware(datetime.combine(dia, abre), timezone.get_current_timezone())
    fim = timezone.make_aware(datetime.combine(dia, fecha), timezone.get_current_timezone())
    atual = inicio
    while atual + timedelta(minutes=duracao) <= fim:
        final = atual + timedelta(minutes=duracao)
        if atual > agora and all(not (atual < e and final > s) for s,e in ocupados):
            horarios.add(atual.strftime('%H:%M'))
        atual += timedelta(minutes=PASSO_MINUTOS)
    return sorted(horarios)

@transaction.atomic
def reservar(cliente, profissional_id, dia, horario, ids):
    # Serializa reservas do mesmo profissional para evitar duas confirmações simultâneas.
    barbeiro = Barbeiro.objects.select_for_update().get(pk=profissional_id, ativo=True)
    servicos = escolher_servicos(ids)
    preco, duracao = totais(servicos)
    if horario not in periodos_livres(barbeiro, dia, duracao):
        raise ValidationError('Horário indisponível. Atualize as opções.')
    h = datetime.strptime(horario, '%H:%M').time()
    agenda = Agendamento.objects.create(
        cliente=cliente, profissional=barbeiro,
        # campos legados obrigatórios, até a etapa de remoção segura
        cliente_nome=cliente.nome, cliente_telefone=cliente.telefone,
        barbeiro_id=_barbeiro_legado(barbeiro),
        data=dia, horario=h, valor_total=preco, duracao_total=duracao,
    )
    AgendamentoServico.objects.bulk_create([
        AgendamentoServico(agendamento=agenda, servico=s, preco_contratado=s.preco, duracao_contratada=s.duracao)
        for s in servicos
    ])
    return agenda

def _barbeiro_legado(barbeiro):
    from .models import Barbeiro as Legado
    antigo = Legado.objects.filter(nome=barbeiro.nome).first()
    if antigo is None:
        antigo = Legado.objects.create(nome=barbeiro.nome, ativo=barbeiro.ativo)
    return antigo.pk
