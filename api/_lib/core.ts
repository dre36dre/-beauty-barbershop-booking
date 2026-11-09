import { createHmac, timingSafeEqual } from 'node:crypto';
import { Pool, type PoolClient } from 'pg';

const globalDb = globalThis as typeof globalThis & { __beautyDbPool?: Pool };

function databaseUrl(): string {
  const url = process.env['DATABASE_URL']
    || process.env['POSTGRES_URL_NON_POOLING']
    || process.env['POSTGRES_URL'];
  if (!url) throw new Error('Configure DATABASE_URL na Vercel.');
  return url;
}

export function getDb(): Pool {
  if (!globalDb.__beautyDbPool) {
    const pool = new Pool({
      connectionString: databaseUrl(),
      max: 3,
      connectionTimeoutMillis: 10_000,
      idleTimeoutMillis: 10_000,
    });
    pool.on('error', (error) => console.error('PostgreSQL pool error:', error));
    globalDb.__beautyDbPool = pool;
  }
  return globalDb.__beautyDbPool;
}

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'Content-Type': 'application/json; charset=utf-8',
    },
  });
}

export function errorJson(message: string, status = 400): Response {
  return json({ erro: message }, status);
}

export async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const value: unknown = await request.json();
    return value && typeof value === 'object' && !Array.isArray(value)
      ? value as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

export function withErrors(
  handler: (request: Request) => Promise<Response>,
): { fetch(request: Request): Promise<Response> } {
  return {
    async fetch(request: Request): Promise<Response> {
      try {
        return await handler(request);
      } catch (error) {
        console.error('API request failed:', error);
        return errorJson('Falha ao acessar o servidor. Tente novamente em instantes.', 500);
      }
    },
  };
}

function secret(): string {
  const value = process.env['ADMIN_SESSION_SECRET'] || process.env['DJANGO_SECRET_KEY'];
  if (!value || value.length < 32) {
    throw new Error('Configure ADMIN_SESSION_SECRET com pelo menos 32 caracteres.');
  }
  return value;
}

function equalSecret(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function validAdminCredentials(username: string, password: string): boolean {
  const expectedUsername = process.env['ADMIN_USERNAME'];
  const expectedPassword = process.env['ADMIN_PASSWORD'];
  return !!expectedUsername && !!expectedPassword
    && equalSecret(username, expectedUsername)
    && equalSecret(password, expectedPassword);
}

function sign(payload: string): string {
  return createHmac('sha256', secret()).update(payload).digest('base64url');
}

export function createAdminCookie(request: Request): string {
  const username = process.env['ADMIN_USERNAME'];
  const password = process.env['ADMIN_PASSWORD'];
  if (!username || !password) {
    throw new Error('Configure ADMIN_USERNAME e ADMIN_PASSWORD na Vercel.');
  }

  const payload = Buffer.from(JSON.stringify({
    sub: username,
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7,
  })).toString('base64url');
  const token = `${payload}.${sign(payload)}`;
  const secure = process.env['VERCEL'] || new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `admin_session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=604800${secure}`;
}

export function verifyAdmin(request: Request): boolean {
  const username = process.env['ADMIN_USERNAME'];
  if (!username) return false;
  const cookie = request.headers.get('cookie') || '';
  const token = cookie.split(';').map((part) => part.trim())
    .find((part) => part.startsWith('admin_session='))?.slice('admin_session='.length);
  if (!token) return false;

  const [payload, signature, extra] = token.split('.');
  if (!payload || !signature || extra !== undefined) return false;
  try {
    if (!equalSecret(sign(payload), signature)) return false;
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      sub?: string;
      exp?: number;
    };
    return session.sub === username && typeof session.exp === 'number' && session.exp > Date.now() / 1000;
  } catch {
    return false;
  }
}

export function requireAdmin(request: Request): Response | null {
  if (verifyAdmin(request)) return null;
  return errorJson('Entre com uma conta administradora para continuar.', 401);
}

export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  return !origin || origin === new URL(request.url).origin;
}

export function dateIsValid(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function numberList(value: unknown): number[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const values = value.map((item) => Number(item));
  if (values.some((item) => !Number.isSafeInteger(item) || item <= 0)) return null;
  return new Set(values).size === values.length ? values : null;
}

export async function activeServices(ids: number[], executor?: Pool | PoolClient) {
  const result = await (executor ?? getDb()).query<{
    id: number;
    nome: string;
    preco: string;
    duracao: number;
    descricao: string;
  }>(
    `SELECT id::int4 AS id, nome, preco::text, duracao, descricao
       FROM servicos_servicos
      WHERE ativo = TRUE AND id = ANY($1::bigint[])
      ORDER BY id`,
    [ids],
  );
  if (result.rows.length !== ids.length) return null;
  return result.rows;
}
