from django.contrib.auth import get_user_model
from django.test import TestCase

from .models import Barbeiro


class AdminPersistenceTests(TestCase):
    def test_admin_creation_is_saved_to_default_database(self):
        admin_user = get_user_model().objects.create_superuser(
            username='admin-teste',
            email='admin@example.com',
            password='senha-de-teste',
        )
        self.client.force_login(admin_user)

        response = self.client.post(
            '/django-admin/barbeiros/barbeiro/add/',
            {'nome': 'Persistente', 'ativo': 'on', '_save': 'Salvar'},
        )

        self.assertEqual(response.status_code, 302)
        self.assertTrue(Barbeiro.objects.filter(nome='Persistente').exists())
