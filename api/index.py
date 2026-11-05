import json
import logging
import os
import sys
from pathlib import Path

logger = logging.getLogger(__name__)
backend_root = Path(__file__).resolve().parents[1] / 'backend'
sys.path.insert(0, str(backend_root))

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'barbearia.settings')

try:
    from barbearia.wsgi import application
except Exception as error:
    error_type = type(error).__name__
    missing_settings = [
        name
        for name in ('DJANGO_SECRET_KEY',)
        if not os.environ.get(name)
    ]
    if not any(
        os.environ.get(name)
        for name in ('DATABASE_URL', 'POSTGRES_URL_NON_POOLING', 'POSTGRES_URL')
    ):
        missing_settings.append('DATABASE_URL (ou POSTGRES_URL)')

    if missing_settings:
        message = f"Configure no ambiente Production: {', '.join(missing_settings)}."
    else:
        message = (
            f'O Django não iniciou ({error_type}). Consulte os Runtime Logs '
            'da Vercel para verificar a causa.'
        )

    logger.error('Django initialization failed (type=%s)', error_type)

    def application(environ, start_response):
        body = json.dumps({'erro': message}, ensure_ascii=False).encode('utf-8')
        start_response(
            '503 Service Unavailable',
            [
                ('Content-Type', 'application/json; charset=utf-8'),
                ('Content-Length', str(len(body))),
                ('Cache-Control', 'no-store'),
            ],
        )
        return [body]
