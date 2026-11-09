import { createAdminCookie, sameOrigin, validAdminCredentials, withErrors } from './_lib/core';
import { json } from './_lib/core';

function loginPage(message: string): Response {
  return new Response(`<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Login administrativo</title><body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#111;color:#f3eee6;font:16px system-ui"><main style="width:min(92vw,420px);padding:32px;border:1px solid #70582a;border-radius:14px;background:#1b1917"><h1 style="color:#dab054">Não foi possível entrar</h1><p>${message}</p><a style="color:#dab054" href="/django-admin/">Tentar novamente</a></main></body></html>`, {
    status: 401,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

export default withErrors(async (request) => {
  if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });
  if (!sameOrigin(request)) return json({ erro: 'Origem da solicitação inválida.' }, 403);

  const username = process.env['ADMIN_USERNAME'];
  const password = process.env['ADMIN_PASSWORD'];
  const sessionSecret = process.env['ADMIN_SESSION_SECRET'] || process.env['DJANGO_SECRET_KEY'];
  if (!username || !password || !sessionSecret || sessionSecret.length < 32) {
    return loginPage('Configure ADMIN_USERNAME, ADMIN_PASSWORD e ADMIN_SESSION_SECRET (ou DJANGO_SECRET_KEY) nas variáveis Production da Vercel.');
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return loginPage('Envie o formulário de login novamente.');
  }
  if (!validAdminCredentials(String(form.get('username') || ''), String(form.get('password') || ''))) {
    return loginPage('Usuário ou senha incorretos.');
  }

  return new Response(null, {
    status: 303,
    headers: {
      Location: '/admin',
      'Set-Cookie': createAdminCookie(request),
      'Cache-Control': 'no-store',
    },
  });
});
