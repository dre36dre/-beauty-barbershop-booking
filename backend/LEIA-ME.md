# Barbearia — back-end Django + PostgreSQL

Este pacote contém o projeto original reorganizado e APIs JSON para o front-end. **Não inclui banco de dados, senha, venv nem backup SQL.**

## Atenção: estado de validação

As migrations 0003 e 0004 preservam o histórico de 0001/0002 e importam profissionais/serviços antigos. **Não foi possível validar as migrations neste ambiente**. A troca do mecanismo para PostgreSQL não copia registros de uma base MySQL existente: se houver dados a preservar, faça uma migração de dados separada e valide-a numa cópia.

## Instalação no Windows (PowerShell)

1. Extraia em uma pasta nova, sem sobrescrever o projeto original.
2. Ative o ambiente virtual existente ou crie outro (`py -m venv venv`; `.\venv\Scripts\Activate.ps1`).
3. `pip install -r requirements.txt`
4. Configure `DATABASE_URL` com a URL PostgreSQL do provedor (localmente, use o `.env.exemplo` como referência; o Django não lê `.env` automaticamente):
   `$env:DATABASE_URL = 'postgresql://USUARIO:SENHA@HOST:5432/BANCO?sslmode=require'`
   `$env:DJANGO_SECRET_KEY = 'CHAVE_LONGA_ALEATORIA'`
5. Confira a conexão e planeje/aplique as migrations no banco PostgreSQL:
   `python manage.py check`
   `python manage.py migrate --plan`
   `python manage.py migrate`
   `python manage.py runserver`

O código do Django está em `backend/`, no mesmo repositório do front-end. A configuração Vercel na raiz executa o Django por meio das funções Python em `api/`, mantendo o front Angular e roteando `/django-admin/` para a tela de login do Django. A Vercel usa o `requirements.txt` na raiz; não altere o diretório raiz do projeto nas configurações da Vercel.

Conecte um PostgreSQL persistente ao projeto e configure `DATABASE_URL` (ou `POSTGRES_URL`) e `DJANGO_SECRET_KEY` no ambiente Production da Vercel antes do deploy. O projeto também reconhece `POSTGRES_URL_NON_POOLING`. Configure `DJANGO_ALLOWED_HOSTS` com os domínios públicos exatos, separados por vírgula. Não coloque senhas ou URLs de conexão no código nem no repositório. No Windows, instale Python e os requisitos da raiz (`py -m pip install -r requirements.txt`), conecte a Vercel CLI ao projeto e aplique as migrations sem baixar os segredos para arquivo local: `npx vercel env run -e production -- py backend\manage.py migrate`. Depois, crie o usuário administrativo com `npx vercel env run -e production -- py backend\manage.py createsuperuser`.

Como front-end e API usam a mesma origem Vercel, `api-base-url` permanece `/api`. O caminho `/admin` pertence ao dashboard Angular; o login administrativo do Django está em `/django-admin/`.

## Endpoints JSON

- `GET /api/csrf/` — define o cookie CSRF para o front-end
- `GET /api/servicos/` — catálogo
- `POST /api/clientes/` — cadastro com `nome`, `telefone`, `endereco`, `email`, `cpf`
- `GET /api/profissionais/?data=2026-11-02&servico_id=1&servico_id=2` — profissionais livres
- `GET /api/horarios/?data=2026-11-02&profissional_id=1&servico_id=1` — horários livres
- `POST /api/resumo/` — `{"servicos":[1,2]}`
- `POST /api/agendamentos/` — `{"cliente_id":1,"profissional_id":1,"data":"2026-11-02","horario":"09:00","servicos":[1,2]}`

POST exige token CSRF do Django quando utilizado por navegador. O front deve enviar cookie `csrftoken` e header `X-CSRFToken`; não desative CSRF. Autenticação/autorização de clientes e políticas de acesso à API ainda precisam ser definidas antes de publicar o serviço na internet. Não exponha o sistema publicamente com DEBUG ativo.

Durante o desenvolvimento, CORS e origens confiáveis de CSRF aceitam `http://localhost:4200` e `http://127.0.0.1:4200`. O Angular deve chamar `GET /api/csrf/` e enviar as requisições com credenciais (`withCredentials: true`), incluindo o valor do cookie `csrftoken` no header `X-CSRFToken`. Para outra origem, configure `CORS_ALLOWED_ORIGINS` e `CSRF_TRUSTED_ORIGINS` no ambiente do Django com as origens exatas, separadas por vírgula.

## Dados legados

A migration 0004 copia barbeiros e serviços legados para os apps dedicados, relaciona os agendamentos ao novo profissional e preserva itens contratados. **Não cria CPF/e-mail fictícios**: agendamentos antigos permanecem com `cliente_nome` e `cliente_telefone`, e `cliente` nulo até a regularização cadastral. As tabelas legadas continuam existindo por compatibilidade e para evitar perda de dados. A limpeza delas deve ser feita numa migração posterior validada.

## Limitações conhecidas

- E-mail padrão vai ao console; SMTP exige configuração.
- Horários calculados em intervalos de 15 minutos, respeitando as jornadas/bloqueios do admin e o horário do salão: terça e sábado, 10h–18h; quarta a sexta, 10h–18h30; fechado domingo e segunda. Quando não há jornada cadastrada para um profissional naquele dia, o horário público do salão é usado como padrão.
- Não inclui pagamento online, login de cliente, cancelamento autenticado ou testes integrados com PostgreSQL.
