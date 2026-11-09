import { json, withErrors } from './_lib/core';

export default withErrors(async (request) => {
  if (request.method !== 'GET') return json({ erro: 'Método não permitido.' }, 405);
  return json({ ok: true });
});
