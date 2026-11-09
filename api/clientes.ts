import { getDb, json, readJson, withErrors } from './_lib/core.js';

export default withErrors(async (request) => {
  if (request.method !== 'POST') return json({ erro: 'Método não permitido.' }, 405);
  const body = await readJson(request);
  if (!body) return json({ erro: 'Envie um objeto JSON válido.' }, 400);

  const nome = typeof body['nome'] === 'string' ? body['nome'].trim() : '';
  const telefone = typeof body['telefone'] === 'string' ? body['telefone'].trim() : '';
  const endereco = typeof body['endereco'] === 'string' ? body['endereco'].trim() : '';
  const email = typeof body['email'] === 'string' ? body['email'].trim().toLowerCase() : null;
  if (!nome || !telefone || !endereco) {
    return json({ erro: 'Preencha todos os campos.' }, 400);
  }
  if (nome.length > 100 || telefone.length > 20 || endereco.length > 255
    || (email !== null && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)))) {
    return json({ erro: 'Confira nome, telefone e endereço.' }, 400);
  }

  const result = await getDb().query<{ id: number; nome: string }>(
    `INSERT INTO clientes_cliente (nome, telefone, "endereço", email)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (email) DO UPDATE
       SET nome = EXCLUDED.nome, telefone = EXCLUDED.telefone, "endereço" = EXCLUDED."endereço"
     RETURNING id::int4 AS id, nome`,
    [nome, telefone, endereco, email],
  );
  return json(result.rows[0], 201);
});
