from django.db import migrations

SERVICOS = [
    {
        'nome': 'Corte',
        'preco': '50.00',
        'duracao': 45,
        'descricao': 'Corte personalizado feminino e masculino com acabamento profissional',
    },
    {
        'nome': 'Coloração',
        'preco': '120.00',
        'duracao': 90,
        'descricao': 'Coloração completa e cobertura uniforme com produtos profissionais',
    },
    {
        'nome': 'Escova',
        'preco': '45.00',
        'duracao': 40,
        'descricao': 'Lavagem especial, secagem e modelagem impecável dos fios',
    },
    {
        'nome': 'Progressiva',
        'preco': '180.00',
        'duracao': 120,
        'descricao': 'Alinhamento térmico capilar de alta performance e brilho espelhado',
    },
    {
        'nome': 'Botox / Selagem',
        'preco': '150.00',
        'duracao': 90,
        'descricao': 'Redução de volume e frizz com reposição profunda de massa capilar',
    },
    {
        'nome': 'Soltura de Cachos',
        'preco': '140.00',
        'duracao': 90,
        'descricao': 'Definição natural, soltura e hidratação profunda para cabelos cacheados e crespos',
    },
    {
        'nome': 'Tratamento',
        'preco': '80.00',
        'duracao': 50,
        'descricao': 'Cronograma capilar intensivo com nutrição, hidratação e reconstrução',
    },
    {
        'nome': 'Luzes',
        'preco': '220.00',
        'duracao': 150,
        'descricao': 'Mechas e pontos de luz com técnica personalizada e clareamento seguro',
    },
    {
        'nome': 'Design de Sobrancelhas',
        'preco': '35.00',
        'duracao': 30,
        'descricao': 'Desenho harmônico, alinhamento e valorização do olhar',
    },
]

def popular(apps, schema_editor):
    Servicos = apps.get_model('servicos', 'Serviços')
    db = schema_editor.connection.alias
    for item in SERVICOS:
        Servicos.objects.using(db).update_or_create(
            nome=item['nome'],
            defaults={
                'preco': item['preco'],
                'duracao': item['duracao'],
                'descricao': item['descricao'],
                'ativo': True,
            }
        )

def remover(apps, schema_editor):
    Servicos = apps.get_model('servicos', 'Serviços')
    db = schema_editor.connection.alias
    nomes = [item['nome'] for item in SERVICOS]
    Servicos.objects.using(db).filter(nome__in=nomes).delete()

class Migration(migrations.Migration):
    dependencies = [('servicos', '0001_initial')]
    operations = [migrations.RunPython(popular, remover)]
