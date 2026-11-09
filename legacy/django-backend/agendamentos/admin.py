from django.contrib import admin
from .models import Agendamento, AgendamentoServico
class ItemInline(admin.TabularInline):
    model = AgendamentoServico
    extra = 0
    readonly_fields = ('preco_contratado','duracao_contratada')
@admin.register(Agendamento)
class AgendamentoAdmin(admin.ModelAdmin):
    list_display = ('id','cliente_nome','profissional','data','horario','valor_total','status')
    list_filter = ('status','data')
    inlines = [ItemInline]
