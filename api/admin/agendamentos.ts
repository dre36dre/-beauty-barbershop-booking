import { getDb, json, requireAdmin, withErrors } from '../_lib/core.js';

export default withErrors(async (request) => {
  if (request.method !== 'GET') return json({ erro: 'Método não permitido.' }, 405);
  const denied = requireAdmin(request);
  if (denied) return denied;

  const result = await getDb().query(
    `SELECT a.id::int4 AS id, a.cliente_nome AS nome,
            to_char(a.horario, 'HH24:MI') AS horario,
            COALESCE(string_agg(s.nome, ' + ' ORDER BY i.id), '') AS servico,
            a.valor_total::float8 AS valor, a.data::text AS data
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
