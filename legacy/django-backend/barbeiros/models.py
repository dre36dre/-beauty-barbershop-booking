
from django.db import models


class Barbeiro(models.Model):
    nome = models.CharField(max_length=100)
    ativo = models.BooleanField(default=True)

    def __str__(self):
        return self.nome


class HorarioTrabalho(models.Model):
    DIAS_SEMANA = [
        (0, "Segunda-feira"),
        (1, "Terça-feira"),
        (2, "Quarta-feira"),
        (3, "Quinta-feira"),
        (4, "Sexta-feira"),
        (5, "Sábado"),
        (6, "Domingo"),
    ]

    barbeiro = models.ForeignKey(
        Barbeiro,
        on_delete=models.CASCADE,
        related_name="horarios_trabalho"
    )

    dia_semana = models.IntegerField(
        choices=DIAS_SEMANA
    )

    hora_inicio = models.TimeField()
    hora_fim = models.TimeField()
    ativo = models.BooleanField(default=True)

    def __str__(self):
        return (
            f"{self.barbeiro.nome} - "
            f"{self.get_dia_semana_display()} "
            f"{self.hora_inicio} às {self.hora_fim}"
        )


class Bloqueio(models.Model):
    barbeiro = models.ForeignKey(
        Barbeiro,
        on_delete=models.CASCADE,
        related_name="bloqueios"
    )

    data_inicio = models.DateTimeField()
    data_fim = models.DateTimeField()

    motivo = models.CharField(
        max_length=200,
        blank=True
    )

    ativo = models.BooleanField(default=True)

    def __str__(self):
        return (
            f"{self.barbeiro.nome} - "
            f"{self.data_inicio} até {self.data_fim}"
        )
