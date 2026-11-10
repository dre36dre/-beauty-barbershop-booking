import { getDb, json, readJson, requireAdmin, sameOrigin, withErrors } from '../_lib/core.js';

export default withErrors(async (request) => {
  if (request.method !== 'GET' && request.method !== 'POST') {
    return json({ erro: 'Método não permitido.' }, 405);
  }
  const denied = requireAdmin(request);
  if (denied) return denied;

  if (request.method === 'POST') {
    if (!sameOrigin(request)) return json({ erro: 'Origem da solicitação inválida.' }, 403);
    const body = await readJson(request);
    const id = Number(body?.['id']);
    if (!Number.isSafeInteger(id) || id <= 0) {
      return json({ erro: 'Informe um agendamento válido.' }, 400);
    }

    const cancelled = await getDb().query<{ id: number }>(
      `UPDATE agendamentos_agendamento
          SET status = 'cancelado'
        WHERE id = $1 AND status = 'agendado'
        RETURNING id::int4 AS id`,
      [id],
    );
    if (!cancelled.rowCount) return json({ erro: 'Agendamento não encontrado ou já cancelado.' }, 404);
    return json({ id: cancelled.rows[0].id, status: 'cancelado' });
  }

  const result = await getDb().query(
    `SELECT a.id::int4 AS id, a.cliente_nome AS nome,
            to_char(a.horario, 'HH24:MI') AS horario,
            COALESCE(string_agg(s.nome, ' + ' ORDER BY i.id), '') AS servico,
            a.valor_total::float8 AS valor, a.data::text AS data,
            a.criado_em::text AS criado_em, a.observacoes
       FROM agendamentos_agendamento a
       LEFT JOIN agendamentos_agendamentoservico i ON i.agendamento_id = a.id
       LEFT JOIN servicos_servicos s ON s.id = i.servico_id
      WHERE a.status = 'agendado'
        AND a.data >= timezone('America/Sao_Paulo', now())::date
      GROUP BY a.id
      ORDER BY a.data, a.horario`,
  );
  return json({ agendamentos: result.rows });
});
