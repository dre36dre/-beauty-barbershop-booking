from django.db import models

class Servicos(models.Model):
    nome = models.CharField(max_length=100)
    descricao = models.TextField(blank=True)
    preco = models.DecimalField(max_digits=8, decimal_places=2)
    duracao = models.PositiveIntegerField(help_text='Duração em minutos')
    ativo = models.BooleanField(default=True)
    def __str__(self):
        return self.nome

# Alias Python; nome histórico da tabela permanece compatível com 0001.
Servico = Servicos
