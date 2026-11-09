import json
from datetime import date
from decimal import Decimal, InvalidOperation
from django.core.exceptions import ValidationError
from django.db import IntegrityError
from django.db import transaction
from django.http import JsonResponse
from django.shortcuts import render
from django.utils import timezone
from django.views.decorators.http import require_GET, require_POST
from django.views.decorators.csrf import ensure_csrf_cookie
from django.core.mail import send_mail
from django.conf import settings
from django.db import transaction
from clientes.models import Cliente
from barbeiros.models import Barbeiro
from servicos.models import Servicos
from .models import Agendamento
from .services import escolher_servicos, totais, periodos_livres, reservar

def erro(msg, status=400):
    if isinstance(msg, ValidationError):
        msg = '; '.join(msg.messages)
    return JsonResponse({'erro':str(msg)}, status=status)

def corpo(request):
    try:
        valor = json.loads(request.body)
        if not isinstance(valor, dict):
            raise ValueError()
        return valor
    except (ValueError, UnicodeDecodeError):
        raise ValidationError('Envie um objeto JSON válido.')

def parse_data(texto):
    try:
        return date.fromisoformat(texto)
    except (TypeError, ValueError):
        raise ValidationError('Data inválida. Use AAAA-MM-DD.')

def inicio(request):
    return render(request, 'agendamentos/inicio.html')

@require_GET
@ensure_csrf_cookie
def csrf_token(request):
    return JsonResponse({'ok': True})

@require_GET
def listar_servicos(request):
    return resposta_servicos()

def resposta_servicos():
    response = JsonResponse({
        'servicos': [
            {
                'id': service.id,
                'nome': service.nome,
                'preco': str(service.preco),
                'duracao': service.duracao,
                'descricao': service.descricao,
            }
            for service in Servicos.objects.filter(ativo=True)
        ],
    })
    response['Cache-Control'] = 'no-store'
    return response

@require_POST
def atualizar_servicos(request):
    if not request.user.is_authenticated or not request.user.is_staff:
        return erro('Acesso restrito a administradores.', 403)

    try:
        data = corpo(request)
        services = data.get('servicos')
        if not isinstance(services, list):
            raise ValidationError('Envie uma lista de servicos.')

        with transaction.atomic():
            active_services = {
                service.pk: service for service in Servicos.objects.filter(ativo=True)
            }
            retained_ids = set()
            updated_ids = set()

            for item in services:
                if not isinstance(item, dict):
                    raise ValidationError('Cada serviço precisa ser um objeto válido.')

                name = item.get('nome')
                description = item.get('descricao', '')
                if not isinstance(name, str) or not name.strip():
                    raise ValidationError('Informe o nome de todos os servicos.')
                if not isinstance(description, str):
                    raise ValidationError('A descrição do serviço precisa ser texto.')

                try:
                    price = Decimal(str(item.get('preco', '')))
                    duration = int(item.get('duracao'))
                except (InvalidOperation, TypeError, ValueError):
                    raise ValidationError('Informe preço e duração válidos.')
                if not price.is_finite() or duration <= 0:
                    raise ValidationError('Preço e duração precisam ser valores válidos.')

                service_id = item.get('id')
                service = None
                if service_id not in (None, 0):
                    if isinstance(service_id, bool) or not isinstance(service_id, int):
                        raise ValidationError('Identificador de serviço inválido.')
                    if service_id in updated_ids:
                        raise ValidationError('Um serviço foi enviado mais de uma vez.')
                    updated_ids.add(service_id)
                    service = active_services.get(service_id)

                if service is None:
                    service = Servicos()
                service.nome = name.strip()
                service.descricao = description.strip()
                service.preco = price
                service.duracao = duration
                service.ativo = True
                service.full_clean()
                service.save()
                retained_ids.add(service.pk)

            Servicos.objects.filter(ativo=True).exclude(pk__in=retained_ids).update(ativo=False)

        return resposta_servicos()
    except (ValidationError, InvalidOperation, ValueError, TypeError) as error:
        return erro(error)

@require_GET
def listar_agendamentos_admin(request):
    if not request.user.is_authenticated or not request.user.is_staff:
        return erro('Acesso restrito a administradores.', 403)

    appointments = (
        Agendamento.objects.filter(status='agendado', data__gte=timezone.localdate())
        .prefetch_related('itens_contratados__servico')
        .order_by('data', 'horario')
    )
    response = JsonResponse({
        'agendamentos': [
            {
                'id': appointment.pk,
                'nome': appointment.cliente_nome,
                'horario': appointment.horario.strftime('%H:%M'),
                'servico': ' + '.join(
                    item.servico.nome for item in appointment.itens_contratados.all()
                ),
                'valor': float(appointment.valor_total),
                'data': appointment.data.isoformat(),
            }
            for appointment in appointments
        ],
    })
    response['Cache-Control'] = 'no-store'
    return response

@require_POST
def cadastrar_cliente(request):
    try:
        d=corpo(request)
        nome=str(d.get('nome','')).strip()
        telefone=str(d.get('telefone','')).strip()
        endereco=str(d.get('endereco','')).strip()
        email=str(d.get('email','')).strip().lower()
        if not all([nome,telefone,endereco,email]):
            return erro('Preencha todos os campos.')
        cliente, _ = Cliente.objects.get_or_create(
            email=email,
            defaults={'nome': nome, 'telefone': telefone, 'endereço': endereco},
        )
        cliente.nome = nome
        cliente.telefone = telefone
        cliente.endereço = endereco
        cliente.full_clean()
        cliente.save()
        return JsonResponse({'id':cliente.pk,'nome':cliente.nome}, status=201)
    except (ValidationError, IntegrityError) as e:
        return erro(e)

@require_GET
def profissionais_disponiveis(request):
    try:
        dia=parse_data(request.GET.get('data'))
        ids=[int(x) for x in request.GET.getlist('servico_id')]
        _, duracao=totais(escolher_servicos(ids))
        dados=[{'id':b.id,'nome':b.nome} for b in Barbeiro.objects.filter(ativo=True) if periodos_livres(b,dia,duracao)]
        return JsonResponse({'profissionais':dados,'duracao_total':duracao})
    except (ValidationError,ValueError) as e:
        return erro(e)

@require_GET
def horarios_disponiveis(request):
    try:
        dia=parse_data(request.GET.get('data'))
        ids=[int(x) for x in request.GET.getlist('servico_id')]
        _,duracao=totais(escolher_servicos(ids))
        b=Barbeiro.objects.get(pk=int(request.GET.get('profissional_id')),ativo=True)
        return JsonResponse({'horarios':periodos_livres(b,dia,duracao)})
    except Barbeiro.DoesNotExist:
        return erro('Profissional não encontrado.',404)
    except (ValidationError,ValueError,TypeError) as e:
        return erro(e)

@require_POST
def resumo(request):
    try:
        d=corpo(request)
        servicos=escolher_servicos(d.get('servicos',[]))
        preco,duracao=totais(servicos)
        return JsonResponse({'servicos':[{'id':s.pk,'nome':s.nome,'preco':str(s.preco),'duracao':s.duracao} for s in servicos], 'valor_total':str(preco),'duracao_total':duracao})
    except (ValidationError,ValueError,TypeError) as e:
        return erro(e)

@require_POST
def confirmar(request):
    try:
        d=corpo(request)
        cliente=Cliente.objects.get(pk=int(d['cliente_id']))
        dia=parse_data(d.get('data'))
        agenda=reservar(cliente,int(d['profissional_id']),dia,str(d['horario']),d.get('servicos',[]))
        def enviar():
            send_mail('Agendamento confirmado', f'Olá, {cliente.nome}! Seu agendamento foi confirmado para {agenda.data:%d/%m/%Y} às {agenda.horario:%H:%M}. Total: R$ {agenda.valor_total}.', settings.DEFAULT_FROM_EMAIL,[cliente.email],fail_silently=True)
        transaction.on_commit(enviar)
        return JsonResponse({'id':agenda.pk,'status':agenda.status,'valor_total':str(agenda.valor_total),'duracao_total':agenda.duracao_total},status=201)
    except (Cliente.DoesNotExist,Barbeiro.DoesNotExist):
        return erro('Cliente ou profissional não encontrado.',404)
    except (KeyError,ValueError,TypeError,ValidationError,IntegrityError) as e:
        return erro(e)
