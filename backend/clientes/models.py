from django.db import models

# Create your models here.

class Cliente(models. Model):
    nome= models.CharField(max_length=100)
    telefone= models.CharField(max_length=20)
    endereço= models.CharField(max_length=255)
    email= models.EmailField(unique=True)
    cpf = models.CharField(max_length=11, unique=True, blank=True, null=True)

    def __str__(self):
        return self.nome
