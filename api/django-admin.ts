import { verifyAdmin, withErrors } from './_lib/core.js';

function loginPage(message = ''): Response {
  const alert = message
    ? `<p class="error" role="alert">${message.replace(/[&<>"']/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    })[char] ?? char)}</p>`
    : '';
  return new Response(`<!doctype html>
<html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Administração | Núcleo da Beleza</title>
<style>
*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:#111;color:#f3eee6;font:16px system-ui,sans-serif}
main{width:min(92vw,420px);padding:32px;border:1px solid #70582a;border-radius:14px;background:#1b1917;box-shadow:0 18px 60px #0008}
h1{margin:0 0 8px;font-size:25px;color:#dab054}p{margin:0 0 22px;color:#c9c1b4}label{display:block;margin:16px 0 6px;font-size:14px}
input{width:100%;padding:12px;border:1px solid #51483a;border-radius:7px;background:#100f0e;color:#fff;font:inherit}
button{width:100%;margin-top:22px;padding:12px;border:0;border-radius:7px;background:#dab054;color:#17130a;font:600 16px system-ui;cursor:pointer}
.error{margin:0 0 14px;color:#ff8d87}.back{display:block;margin-top:20px;color:#dab054;text-align:center}
</style><main><h1>Painel administrativo</h1><p>Entre com a conta administrativa configurada para este projeto.</p>${alert}
<form method="post" action="/django-admin/login/">
<label for="username">Usuário</label><input id="username" name="username" autocomplete="username" required>
<label for="password">Senha</label><input id="password" name="password" type="password" autocomplete="current-password" required>
<button type="submit">Entrar</button></form><a class="back" href="/admin">Voltar ao painel</a></main></html>`, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

export default withErrors(async (request) => {
  if (request.method !== 'GET') return new Response('Method Not Allowed', { status: 405 });
  if (verifyAdmin(request)) {
    return new Response(null, { status: 303, headers: { Location: '/admin', 'Cache-Control': 'no-store' } });
  }
  return loginPage();
});
