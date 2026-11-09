import { getDb, json, withErrors } from './_lib/core.js';

export default withErrors(async (request) => {
  if (request.method !== 'GET') return json({ erro: 'Método não permitido.' }, 405);
  const result = await getDb().query(
    `SELECT id::int4 AS id, nome, preco::text, duracao, descricao
       FROM servicos_servicos
      WHERE ativo = TRUE
      ORDER BY id`,
  );
  return json({ servicos: result.rows });
});
