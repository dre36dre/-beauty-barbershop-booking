import os

from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path
from django.views.decorators.http import require_GET


@require_GET
def teste_database_url(request):
    response = JsonResponse({'db_configurada': bool(os.environ.get('DATABASE_URL'))})
    response['Cache-Control'] = 'no-store'
    return response

urlpatterns = [
    path('django-admin/', admin.site.urls),
    path('teste/', teste_database_url, name='teste_database_url'),
    path('', include('agendamentos.urls')),
]