import json
import logging
import os
from pathlib import Path
import sys

logger = logging.getLogger(__name__)
backend_root = Path(__file__).resolve().parent
sys.path.insert(0, str(backend_root))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'barbearia.settings')


def initialization_error():
    missing = []
    if not (
        os.environ.get('DJANGO_SECRET_KEY')
        or os.environ.get('SECRET_KEY')
    ):
        missing.append('DJANGO_SECRET_KEY ou SECRET_KEY')

    if not any(
        os.environ.get(name)
        for name in ('DATABASE_URL', 'POSTGRES_URL_NON_POOLING', 'POSTGRES_URL')
    ):
        missing.append('DATABASE_URL ou POSTGRES_URL')

    if missing:
        message = f"Configure no ambiente Production: {', '.join(missing)}."
    else:
        message = 'O servidor de agendamentos não conseguiu iniciar. Consulte os Runtime Logs.'

    body = json.dumps({'erro': message}, ensure_ascii=False).encode('utf-8')

    def app(environ, start_response):
        start_response(
            '503 Service Unavailable',
            [
                ('Content-Type', 'application/json; charset=utf-8'),
                ('Content-Length', str(len(body))),
                ('Cache-Control', 'no-store'),
            ],
        )
        return [body]

    return app


def django_handler(path_info):
    try:
        from barbearia.wsgi import application as django_application
    except Exception as error:
        logger.exception('Django initialization failed (%s)', type(error).__name__)
        return initialization_error()

    def app(environ, start_response):
        routed_environ = environ.copy()
        routed_environ['PATH_INFO'] = path_info
        routed_environ['SCRIPT_NAME'] = ''
        return django_application(routed_environ, start_response)

    return app
