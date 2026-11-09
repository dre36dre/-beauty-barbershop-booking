import type { Pool, PoolClient } from 'pg';
import { activeServices, dateIsValid, getDb } from './core.js';

type Executor = Pool | PoolClient;
type TimeRange = { start: number; end: number };

const OPENING: Record<number, TimeRange> = {
  1: { start: 600, end: 1080 },
  2: { start: 600, end: 1110 },
  3: { start: 600, end: 1110 },
  4: { start: 600, end: 1110 },
  5: { start: 600, end: 1080 },
};

function localDateTime(): { date: string; minutes: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? '';
  const date = `${part('year')}-${part('month')}-${part('day')}`;
  const clock = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date());
  const hour = Number(clock.find((item) => item.type === 'hour')?.value ?? '0');
  const minute = Number(clock.find((item) => item.type === 'minute')?.value ?? '0');
  return { date, minutes: hour * 60 + minute };
}

function weekdayFor(date: string): number {
  const [year, month, day] = date.split('-').map(Number);
  const dayOfWeek = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return (dayOfWeek + 6) % 7;
}

function minutesOf(value: string): number {
  const [hour, minute] = value.split(':').map(Number);
  return hour * 60 + minute;
}

function formatTime(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

async function serviceDuration(ids: number[], executor: Executor): Promise<number | null> {
  const services = await activeServices(ids, executor);
  return services ? services.reduce((sum, service) => sum + Number(service.duracao), 0) : null;
}

export async function availableTimes(
  date: string,
  professionalId: number,
  serviceIds: number[],
  executor: Executor = getDb(),
): Promise<string[] | null> {
  if (!dateIsValid(date)) return null;
  const duration = await serviceDuration(serviceIds, executor);
  if (!duration || duration <= 0) return null;

  const now = localDateTime();
  if (date < now.date) return [];
  const weekday = weekdayFor(date);
  const opening = OPENING[weekday];
  if (!opening) return [];

  const professional = await executor.query<{ id: number }>(
    'SELECT id::int4 AS id FROM barbeiros_barbeiro WHERE id = $1 AND ativo = TRUE',
    [professionalId],
  );
  if (!professional.rowCount) return null;

  const schedules = await executor.query<{ hora_inicio: string; hora_fim: string }>(
    `SELECT hora_inicio::text, hora_fim::text
       FROM barbeiros_horariotrabalho
      WHERE barbeiro_id = $1 AND dia_semana = $2 AND ativo = TRUE`,
    [professionalId, weekday],
  );
  const ranges = schedules.rows.length
    ? schedules.rows.map((row) => ({
      start: Math.max(minutesOf(row.hora_inicio), opening.start),
      end: Math.min(minutesOf(row.hora_fim), opening.end),
    }))
    : [opening];

  const appointments = await executor.query<{ horario: string; duracao_total: number }>(
    `SELECT horario::text, duracao_total
       FROM agendamentos_agendamento
      WHERE profissional_id = $1 AND data = $2::date
        AND status = 'agendado' AND duracao_total > 0`,
    [professionalId, date],
  );
  const occupied: TimeRange[] = appointments.rows.map((row) => {
    const start = minutesOf(row.horario);
    return { start, end: start + Number(row.duracao_total) };
  });

  const blocks = await executor.query<{ start_min: number; end_min: number }>(
    `WITH bounds AS (
       SELECT $2::date::timestamp AT TIME ZONE 'America/Sao_Paulo' AS start_at,
              ($2::date + 1)::timestamp AT TIME ZONE 'America/Sao_Paulo' AS end_at
     )
     SELECT GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (GREATEST(b.data_inicio, bounds.start_at) - bounds.start_at)) / 60))::int AS start_min,
            LEAST(1440, CEIL(EXTRACT(EPOCH FROM (LEAST(b.data_fim, bounds.end_at) - bounds.start_at)) / 60))::int AS end_min
       FROM barbeiros_bloqueio b CROSS JOIN bounds
      WHERE b.barbeiro_id = $1 AND b.ativo = TRUE
        AND b.data_inicio < bounds.end_at AND b.data_fim > bounds.start_at`,
    [professionalId, date],
  );
  occupied.push(...blocks.rows.map((block) => ({ start: block.start_min, end: block.end_min })));

  const times = new Set<string>();
  for (const range of ranges) {
    for (let start = range.start; start + duration <= range.end; start += 15) {
      if (date === now.date && start <= now.minutes) continue;
      const end = start + duration;
      if (occupied.some((slot) => start < slot.end && end > slot.start)) continue;
      times.add(formatTime(start));
    }
  }
  return [...times].sort();
}

export async function availableProfessionals(date: string, serviceIds: number[]) {
  if (!dateIsValid(date)) return null;
  const duration = await serviceDuration(serviceIds, getDb());
  if (!duration || duration <= 0) return null;
  const result = await getDb().query<{ id: number; nome: string }>(
    'SELECT id::int4 AS id, nome FROM barbeiros_barbeiro WHERE ativo = TRUE ORDER BY id',
  );
  const available = [];
  for (const professional of result.rows) {
    const horarios = await availableTimes(date, professional.id, serviceIds);
    if (horarios?.length) available.push(professional);
  }
  return { profissionais: available, duracao_total: duration };
}
