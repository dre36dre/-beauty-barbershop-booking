from django.test import SimpleTestCase
from unittest.mock import patch

from .settings import BASE_DIR, _database_config, _env_bool, _env_value, env_list


class DatabaseConfigTests(SimpleTestCase):
    def test_legacy_secret_key_name_is_supported(self):
        self.assertEqual(
            _env_value({'SECRET_KEY': 'legacy-secret'}, 'DJANGO_SECRET_KEY', 'SECRET_KEY'),
            'legacy-secret',
        )

    def test_legacy_debug_false_value_is_parsed_as_false(self):
        self.assertFalse(_env_bool({'DEBUG': 'False'}, 'DJANGO_DEBUG', 'DEBUG', True))

    def test_legacy_allowed_hosts_name_is_supported(self):
        with patch.dict('os.environ', {'ALLOWED_HOSTS': 'meu-projeto.vercel.app'}):
            self.assertEqual(
                env_list('DJANGO_ALLOWED_HOSTS', 'localhost', alias='ALLOWED_HOSTS'),
                ['meu-projeto.vercel.app'],
            )

    def test_django_prefixed_values_take_precedence(self):
        self.assertEqual(
            _env_value(
                {'DJANGO_SECRET_KEY': 'preferred', 'SECRET_KEY': 'legacy'},
                'DJANGO_SECRET_KEY',
                'SECRET_KEY',
            ),
            'preferred',
        )

    def test_database_url_diagnostic_reports_presence_without_exposing_value(self):
        with patch.dict('os.environ', {'DATABASE_URL': 'postgresql://user:secret@db.example.com/barbearia'}):
            response = self.client.get('/teste/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {'db_configurada': True})
        self.assertNotIn('secret', response.content.decode())

    def test_database_url_diagnostic_reports_missing_variable(self):
        with patch.dict('os.environ', {'DATABASE_URL': ''}):
            response = self.client.get('/teste/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {'db_configurada': False})

    def test_local_mysql_config(self):
        config = _database_config({
            'DB_ENGINE': 'mysql',
            'MYSQL_DATABASE': 'barbearia',
            'MYSQL_USER': 'local-user',
            'MYSQL_PASSWORD': 'local-password',
            'MYSQL_HOST': '127.0.0.1',
            'MYSQL_PORT': '3307',
        })

        self.assertEqual(config['ENGINE'], 'django.db.backends.mysql')
        self.assertEqual(config['HOST'], '127.0.0.1')
        self.assertEqual(config['PORT'], '3307')

    def test_local_postgresql_config(self):
        config = _database_config({
            'DB_ENGINE': 'postgresql',
            'POSTGRES_DB': 'barbearia',
            'POSTGRES_USER': 'local-user',
            'POSTGRES_PASSWORD': 'local-password',
            'POSTGRES_HOST': '127.0.0.1',
            'POSTGRES_PORT': '5433',
        })

        self.assertEqual(config['ENGINE'], 'django.db.backends.postgresql')
        self.assertEqual(config['HOST'], '127.0.0.1')
        self.assertEqual(config['PORT'], '5433')
        self.assertEqual(config['OPTIONS'], {'sslmode': 'disable'})

    def test_remote_postgresql_url_includes_tls_options(self):
        config = _database_config({
            'DATABASE_URL': 'postgresql://db-user:example-password@db.example.com/barbearia?sslmode=require',
        })

        self.assertEqual(config['ENGINE'], 'django.db.backends.postgresql')
        self.assertEqual(config['PASSWORD'], 'example-password')
        self.assertEqual(config['HOST'], 'db.example.com')
        self.assertEqual(config['OPTIONS'], {'sslmode': 'require'})

    def test_database_url_rejects_non_postgresql_schemes(self):
        with self.assertRaises(ValueError):
            _database_config({'DATABASE_URL': 'mysql://db.example.com/barbearia'})

    def test_local_sqlite_config(self):
        config = _database_config({'DB_ENGINE': 'sqlite'})

        self.assertEqual(config['ENGINE'], 'django.db.backends.sqlite3')
        self.assertEqual(config['NAME'], str(BASE_DIR / 'db.sqlite3'))

    def test_local_database_defaults_to_sqlite(self):
        config = _database_config({})

        self.assertEqual(config['ENGINE'], 'django.db.backends.sqlite3')
        self.assertEqual(config['NAME'], str(BASE_DIR / 'db.sqlite3'))

    def test_vercel_requires_a_persistent_postgresql_url(self):
        with self.assertRaises(ValueError):
            _database_config({'VERCEL': '1', 'DEBUG': 'False', 'DB_ENGINE': 'sqlite'})
