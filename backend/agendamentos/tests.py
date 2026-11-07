import json
from datetime import date, time
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase

from barbeiros.models import Barbeiro as Profissional
from servicos.models import Servicos
from .models import Agendamento, AgendamentoServico, Barbeiro


class CalcularTotaisTests(TestCase):
	def test_calcula_totais_dos_itens_contratados(self):
		profissional = Profissional.objects.create(nome='Profissional')
		barbeiro_legado = Barbeiro.objects.create(nome='Profissional')
		agendamento = Agendamento.objects.create(
			profissional=profissional,
			barbeiro=barbeiro_legado,
			cliente_nome='Cliente',
			cliente_telefone='11999999999',
			data=date(2026, 11, 2),
			horario=time(9, 0),
		)
		servico = Servicos.objects.create(
			nome='Corte', preco=Decimal('45.00'), duracao=30
		)
		AgendamentoServico.objects.create(
			agendamento=agendamento,
			servico=servico,
			preco_contratado=Decimal('40.00'),
			duracao_contratada=35,
		)

		agendamento.calcular_totais()
		agendamento.refresh_from_db()

		self.assertEqual(agendamento.valor_total, Decimal('40.00'))
		self.assertEqual(agendamento.duracao_total, 35)


class CsrfEndpointTests(TestCase):
	def test_endpoint_define_cookie_csrf(self):
		response = self.client.get('/api/csrf/')

		self.assertEqual(response.status_code, 200)
		self.assertIn('csrftoken', response.cookies)

	def test_preflight_cors_permite_origem_angular_local(self):
		response = self.client.options(
			'/api/clientes/',
			HTTP_ORIGIN='http://localhost:4200',
			HTTP_ACCESS_CONTROL_REQUEST_METHOD='POST',
			HTTP_ACCESS_CONTROL_REQUEST_HEADERS='content-type,x-csrftoken',
		)

		self.assertEqual(response.status_code, 200)
		self.assertEqual(
			response['Access-Control-Allow-Origin'], 'http://localhost:4200'
		)
		self.assertEqual(response['Access-Control-Allow-Credentials'], 'true')


class ServiceManagementApiTests(TestCase):
	def setUp(self):
		self.service = Servicos.objects.create(
			nome='Corte', preco=Decimal('50.00'), duracao=45, descricao='Original'
		)

	def post_services(self, services):
		return self.client.post(
			'/api/servicos/atualizar/',
			data=json.dumps({'servicos': services}),
			content_type='application/json',
		)

	def test_service_changes_require_staff_login(self):
		response = self.post_services([])

		self.assertEqual(response.status_code, 403)
		self.service.refresh_from_db()
		self.assertTrue(self.service.ativo)

	def test_staff_can_update_and_add_services_for_all_clients(self):
		user = get_user_model().objects.create_user(
			username='admin', password='password', is_staff=True
		)
		self.client.force_login(user)

		response = self.post_services([
			{
				'id': self.service.pk,
				'nome': 'Corte atualizado',
				'preco': '65.00',
				'duracao': 50,
				'descricao': 'Novo valor',
			},
			{
				'id': 0,
				'nome': 'Novo serviço',
				'preco': '30.00',
				'duracao': 20,
				'descricao': '',
			},
		])

		self.assertEqual(response.status_code, 200)
		self.assertEqual(len(response.json()['servicos']), 2)
		self.service.refresh_from_db()
		self.assertEqual(self.service.nome, 'Corte atualizado')
		self.assertEqual(self.service.preco, Decimal('65.00'))

	def test_omitted_services_are_deactivated_not_deleted(self):
		user = get_user_model().objects.create_user(
			username='admin', password='password', is_staff=True
		)
		self.client.force_login(user)

		response = self.post_services([])

		self.assertEqual(response.status_code, 200)
		self.assertEqual(response.json()['servicos'], [])
		self.service.refresh_from_db()
		self.assertFalse(self.service.ativo)

	def test_invalid_service_does_not_partially_update_the_catalog(self):
		user = get_user_model().objects.create_user(
			username='admin', password='password', is_staff=True
		)
		self.client.force_login(user)

		response = self.post_services([
			{
				'id': self.service.pk,
				'nome': 'Corte atualizado',
				'preco': '65.00',
				'duracao': 50,
				'descricao': '',
			},
			{'id': 0, 'nome': '', 'preco': '20.00', 'duracao': 20, 'descricao': ''},
		])

		self.assertEqual(response.status_code, 400)
		self.service.refresh_from_db()
		self.assertEqual(self.service.nome, 'Corte')
		self.assertEqual(self.service.preco, Decimal('50.00'))


class AdminAppointmentsApiTests(TestCase):
	def test_appointment_list_requires_staff_login(self):
		response = self.client.get('/api/admin/agendamentos/')

		self.assertEqual(response.status_code, 403)
