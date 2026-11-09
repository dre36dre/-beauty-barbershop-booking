import { availableProfessionals } from './_lib/booking.js';
import { json, numberList, withErrors } from './_lib/core.js';

export default withErrors(async (request) => {
  if (request.method !== 'GET') return json({ erro: 'Método não permitido.' }, 405);
  const url = new URL(request.url);
  const date = url.searchParams.get('data');
  const serviceIds = numberList(url.searchParams.getAll('servico_id'));
  if (!date || !serviceIds) return json({ erro: 'Informe data e serviços válidos.' }, 400);
  const result = await availableProfessionals(date, serviceIds);
  if (!result) return json({ erro: 'Data ou serviços inválidos.' }, 400);
  return json(result);
});
