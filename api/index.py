import os
import sys
from pathlib import Path

backend_root = Path(__file__).resolve().parents[1] / 'Barbearia'
sys.path.insert(0, str(backend_root))

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'barbearia.settings')

from barbearia.wsgi import application

app = application
