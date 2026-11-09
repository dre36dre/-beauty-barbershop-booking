from django.db import models
from django.core.exceptions import ValidationError
from django.utils import timezone
from datetime import datetime, timedelta
from decimal import Decimal

class Barbeiro(models.Model):
    nome = models.CharField(max_length=100)
    ativo = models.BooleanField(default=True)

    def __str__(self):
        return self.nome


class Servico(models.Model):
    nome = models.CharField(max_length=100)
    descricao = models.TextField(blank=True)
    preco = models.DecimalField(max_digits=8, decimal_places=2)
    duracao = models.PositiveIntegerField(
        help_text="Duração em minutos"
    )
    ativo = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.nome} (R$ {self.preco})"


class Agendamento(models.Model):
    STATUS_CHOICES = [
        ("agendado", "Agendado"),
        ("cancelado", "Cancelado"),
        ("concluido", "Concluído"),
    ]

    cliente = models.ForeignKey('clientes.Cliente', null=True, blank=True, on_delete=models.PROTECT, related_name='agendamentos')
    profissional = models.ForeignKey('barbeiros.Barbeiro', null=True, blank=True, on_delete=models.PROTECT, related_name='reservas')
    cliente_nome = models.CharField(max_length=100)
    cliente_telefone = models.CharField(max_length=20)

    barbeiro = models.ForeignKey(
        Barbeiro,
        on_delete=models.CASCADE,
        related_name="agendamentos"
    )

    # 1. Alterado para ManyToManyField para permitir múltiplos serviços
    servicos = models.ManyToManyField(
        Servico,
        related_name="agendamentos"
    )

    itens = models.ManyToManyField('servicos.Servicos', through='AgendamentoServico', related_name='reservas', blank=True)
    data = models.DateField()
    horario = models.TimeField()

    # 2. Novos campos para controle financeiro e tempo
    valor_total = models.DecimalField(
        max_digits=8,
        decimal_places=2,
        default=0.00,
        help_text="Valor total somado de todos os serviços"
    )
    duracao_total = models.PositiveIntegerField(
        default=0,
        help_text="Duração total somada em minutos"
    )

    criado_em = models.DateTimeField(auto_now_add=True)

    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default="agendado"
    )

    @property
    def horario_fim(self):
        return (datetime.combine(self.data, self.horario) + timedelta(minutes=self.duracao_total)).time()

    def calcular_totais(self):
        """Recalcula os totais usando os valores registrados nos itens contratados."""
        itens = list(self.itens_contratados.all())
        self.valor_total = sum(
            (item.preco_contratado for item in itens), Decimal('0.00')
        )
        self.duracao_total = sum(item.duracao_contratada for item in itens)
        self.save(update_fields=['valor_total', 'duracao_total'])

    def __str__(self):
        # Correção da string formatada
        return f"{self.cliente_nome} - {self.data} às {self.horario}"

class AgendamentoServico(models.Model):
    agendamento = models.ForeignKey(Agendamento, on_delete=models.CASCADE, related_name='itens_contratados')
    servico = models.ForeignKey('servicos.Servicos', on_delete=models.PROTECT)
    preco_contratado = models.DecimalField(max_digits=8, decimal_places=2)
    duracao_contratada = models.PositiveIntegerField()

    class Meta:
        constraints = [models.UniqueConstraint(fields=['agendamento', 'servico'], name='unique_servico_agendamento')]

    def __str__(self):
        return f'{self.servico.nome}: R$ {self.preco_contratado}'
