from django.urls import path
from . import views
urlpatterns = [
    path('', views.inicio, name='inicio'),
    path('api/csrf/', views.csrf_token, name='api_csrf'),
    path('api/servicos/', views.listar_servicos, name='api_servicos'),
    path('api/servicos/atualizar/', views.atualizar_servicos, name='api_atualizar_servicos'),
    path('api/clientes/', views.cadastrar_cliente, name='api_clientes'),
    path('api/profissionais/', views.profissionais_disponiveis, name='api_profissionais'),
    path('api/horarios/', views.horarios_disponiveis, name='api_horarios'),
    path('api/resumo/', views.resumo, name='api_resumo'),
    path('api/agendamentos/', views.confirmar, name='api_agendamentos'),
]
