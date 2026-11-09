import { getDb, json, readJson, requireAdmin, sameOrigin, withErrors } from '../_lib/core';

export default withErrors(async (request) => {
  if (request.method !== 'POST') return json({ erro: 'Método não permitido.' }, 405);
  const denied = requireAdmin(request);
  if (denied) return denied;
  if (!sameOrigin(request)) return json({ erro: 'Origem da solicitação inválida.' }, 403);

  const body = await readJson(request);
  if (!Array.isArray(body?.['servicos'])) return json({ erro: 'Envie uma lista de serviços.' }, 400);
  const services = body['servicos'] as Array<Record<string, unknown>>;
  const client = await getDb().connect();
  try {
    await client.query('BEGIN');
    const current = await client.query<{ id: number }>(
      'SELECT id FROM servicos_servicos WHERE ativo = TRUE',
    );
    const activeIds = new Set(current.rows.map((row) => Number(row.id)));
    const retained = new Set<number>();
    const receivedIds = new Set<number>();

    for (const item of services) {
      const nome = typeof item['nome'] === 'string' ? item['nome'].trim() : '';
      const descricao = typeof item['descricao'] === 'string' ? item['descricao'].trim() : '';
      const preco = String(item['preco'] ?? '');
      const duracao = Number(item['duracao']);
      if (!nome || nome.length > 100 || !/^\d{1,6}(?:\.\d{1,2})?$/.test(preco)
        || !Number.isSafeInteger(duracao) || duracao <= 0) {
        await client.query('ROLLBACK');
        return json({ erro: 'Informe nome, preço e duração válidos para todos os serviços.' }, 400);
      }

      let id: number | null = null;
      if (item['id'] !== undefined && item['id'] !== null && item['id'] !== 0) {
        id = Number(item['id']);
        if (!Number.isSafeInteger(id) || !activeIds.has(id) || receivedIds.has(id)) {
          await client.query('ROLLBACK');
          return json({ erro: 'Identificador de serviço inválido ou repetido.' }, 400);
        }
        receivedIds.add(id);
      }

      if (id === null) {
        const inserted = await client.query<{ id: number }>(
          `INSERT INTO servicos_servicos (nome, descricao, preco, duracao, ativo)
           VALUES ($1, $2, $3, $4, TRUE) RETURNING id::int4 AS id`,
          [nome, descricao, preco, duracao],
        );
        retained.add(Number(inserted.rows[0].id));
      } else {
        await client.query(
          `UPDATE servicos_servicos
              SET nome = $2, descricao = $3, preco = $4, duracao = $5, ativo = TRUE
            WHERE id = $1`,
          [id, nome, descricao, preco, duracao],
        );
        retained.add(id);
      }
    }

    await client.query(
      'UPDATE servicos_servicos SET ativo = FALSE WHERE ativo = TRUE AND NOT (id = ANY($1::bigint[]))',
      [[...retained]],
    );
    const result = await client.query(
      `SELECT id::int4 AS id, nome, preco::text, duracao, descricao
         FROM servicos_servicos WHERE ativo = TRUE ORDER BY id`,
    );
    await client.query('COMMIT');
    return json({ servicos: result.rows });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
});
