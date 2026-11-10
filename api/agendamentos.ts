import type { PoolClient } from 'pg';
import { availableTimes } from './_lib/booking.js';
import { activeServices, getDb, json, numberList, readJson, withErrors } from './_lib/core.js';

export default withErrors(async (request) => {
  if (request.method !== 'POST') return json({ erro: 'Método não permitido.' }, 405);
  const body = await readJson(request);
  if (!body) return json({ erro: 'Envie um objeto JSON válido.' }, 400);

  const clienteId = Number(body['cliente_id']);
  const professionalId = Number(body['profissional_id']);
  const date = body['data'];
  const time = typeof body['horario'] === 'string' ? body['horario'] : '';
  const observacoes = typeof body['observacoes'] === 'string' ? body['observacoes'].trim() : '';
  const serviceIds = numberList(body['servicos']);
  if (!Number.isSafeInteger(clienteId) || clienteId <= 0
    || !Number.isSafeInteger(professionalId) || professionalId <= 0
    || typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)
    || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time) || !serviceIds
    || observacoes.length > 255) {
    return json({ erro: 'Informe cliente, profissional, data, horário e serviços válidos.' }, 400);
  }

  const client = await getDb().connect();
  try {
    await client.query('BEGIN');
    const customer = await client.query<{ id: number; nome: string; telefone: string }>(
      'SELECT id, nome, telefone FROM clientes_cliente WHERE id = $1',
      [clienteId],
    );
    if (!customer.rowCount) {
      await client.query('ROLLBACK');
      return json({ erro: 'Os dados do cliente não foram encontrados. Preencha novamente seus dados.' }, 404);
    }

    const professional = await client.query<{ id: number; nome: string }>(
      'SELECT id::int4 AS id, nome FROM barbeiros_barbeiro WHERE id = $1 AND ativo = TRUE FOR UPDATE',
      [professionalId],
    );
    if (!professional.rowCount) {
      await client.query('ROLLBACK');
      return json({ erro: 'O profissional selecionado não está cadastrado ou ativo. Atualize a página e escolha outro horário.' }, 404);
    }

    const times = await availableTimes(date, professionalId, serviceIds, client);
    if (!times) {
      await client.query('ROLLBACK');
      return json({ erro: 'Data, profissional ou serviços inválidos.' }, 400);
    }
    if (!times.includes(time)) {
      await client.query('ROLLBACK');
      return json({ erro: 'Horário indisponível. Atualize as opções e escolha outro horário.' }, 409);
    }

    const services = await activeServices(serviceIds, client);
    if (!services) {
      await client.query('ROLLBACK');
      return json({ erro: 'Há serviços inválidos ou inativos.' }, 400);
    }
    const totals = await client.query<{ preco: string; duracao: number }>(
      `SELECT SUM(preco)::numeric(8,2)::text AS preco, SUM(duracao)::int AS duracao
         FROM servicos_servicos WHERE ativo = TRUE AND id = ANY($1::bigint[])`,
      [serviceIds],
    );

    const legacyBarber = await client.query<{ id: number }>(
      'SELECT id FROM agendamentos_barbeiro WHERE nome = $1 ORDER BY id LIMIT 1',
      [professional.rows[0].nome],
    );
    let legacyBarberId = legacyBarber.rows[0]?.id;
    if (!legacyBarberId) {
      const insertedLegacy = await client.query<{ id: number }>(
        'INSERT INTO agendamentos_barbeiro (nome, ativo) VALUES ($1, TRUE) RETURNING id::int4 AS id',
        [professional.rows[0].nome],
      );
      legacyBarberId = insertedLegacy.rows[0].id;
    }

    const created = await client.query<{
      id: number; status: string; valor_total: string; duracao_total: number;
    }>(
      `INSERT INTO agendamentos_agendamento
         (cliente_id, profissional_id, cliente_nome, cliente_telefone, barbeiro_id,
          data, horario, valor_total, duracao_total, observacoes, criado_em, status)
       VALUES ($1, $2, $3, $4, $5, $6::date, $7::time, $8, $9, $10, NOW(), 'agendado')
       RETURNING id::int4 AS id, status, valor_total::text, duracao_total`,
      [clienteId, professionalId, customer.rows[0].nome, customer.rows[0].telefone,
        legacyBarberId, date, time, totals.rows[0].preco, totals.rows[0].duracao, observacoes],
    );

    for (const service of services) {
      await client.query(
        `INSERT INTO agendamentos_agendamentoservico
           (agendamento_id, servico_id, preco_contratado, duracao_contratada)
         VALUES ($1, $2, $3, $4)`,
        [created.rows[0].id, service.id, service.preco, service.duracao],
      );
    }

    await client.query('COMMIT');
    return json(created.rows[0], 201);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
});
