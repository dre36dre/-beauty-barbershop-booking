# Barbearia — back-end Django

Este pacote contém o backend Django e APIs JSON para o front-end. **Não inclui banco de dados, senhas, ambiente virtual ou backup SQL.**

## Bancos local e remoto

O Django carrega `backend\.env` automaticamente. Copie `.env.exemplo` para `.env` e escolha `DB_ENGINE=mysql`, `postgresql` ou `sqlite` para desenvolvimento local. `DATABASE_URL` tem prioridade sobre `DB_ENGINE` e deve ser usada para PostgreSQL remoto. A Vercel usa as variáveis Production configuradas no painel e exige PostgreSQL persistente; os valores do `.env` local não são enviados ao deploy.

As bases local e remota são independentes, a menos que ambas as execuções apontem para a mesma URL. Trocar de banco não copia os dados existentes.

## Instalação no Windows (PowerShell)

Na raiz do repositório, instale Python e as dependências:

```powershell
py -m pip install -r requirements.txt
Copy-Item backend\.env.exemplo backend\.env
```

Edite `backend\.env` para escolher o banco. Para usar MySQL no Windows, instale também o `mysqlclient` incluído nas dependências; para SQLite, defina `DB_ENGINE=sqlite`. Depois, na pasta `backend`, confira e aplique as migrations:

```powershell
py manage.py check
py manage.py migrate --plan
py manage.py migrate
py manage.py runserver
```

O arquivo `.env` é ignorado pelo Git. Nunca coloque credenciais no código nem as compartilhe.

## Vercel

O código do Django está em `backend/`, no mesmo repositório do front-end. As funções Python em `api/` encaminham as requisições para o Django. Não altere a raiz do projeto Vercel.

Configure `DATABASE_URL` (ou `POSTGRES_URL`) e `DJANGO_SECRET_KEY` no ambiente Production da Vercel. O projeto também reconhece `POSTGRES_URL_NON_POOLING`. Configure `DJANGO_ALLOWED_HOSTS` com os domínios públicos exatos, separados por vírgula. As migrations são aplicadas automaticamente no build de Production; os valores Production precisam estar disponíveis durante o build. Após o primeiro deploy bem-sucedido, crie o usuário administrativo:

```powershell
npx vercel env run -e production -- py backend\manage.py createsuperuser
```

Como a API e o front-end usam a mesma origem Vercel, `api-base-url` permanece `/api`. O caminho `/admin` pertence ao dashboard Angular; o login administrativo do Django está em `/django-admin/`.

## Endpoints JSON

- `GET /api/csrf/` — define o cookie CSRF para o front-end.
- `GET /api/servicos/` — lista o catálogo.
- `POST /api/clientes/` — cadastra cliente.
- `GET /api/profissionais/?data=AAAA-MM-DD&servico_id=1` — lista profissionais disponíveis.
- `GET /api/horarios/?data=AAAA-MM-DD&profissional_id=1&servico_id=1` — lista horários disponíveis.
- `POST /api/resumo/` — calcula o resumo dos serviços.
- `POST /api/agendamentos/` — confirma e persiste uma reserva.

POSTs do navegador usam o token CSRF do Django: envie o cookie `csrftoken` no header `X-CSRFToken` e use credenciais. Não desative a proteção CSRF nem publique com `DEBUG` ativo.

## Dados legados e limitações

As migrations 0003 e 0004 preservam o histórico e copiam os registros legados. Faça backup e valide as migrations em uma cópia antes de aplicá-las a um banco que contenha dados importantes. A migration não transfere dados entre bancos.

O e-mail padrão vai ao console; SMTP exige configuração. O backend não inclui pagamento online, login de cliente ou cancelamento autenticado.
