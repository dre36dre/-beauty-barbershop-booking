import { availableTimes } from './_lib/booking.js';
import { json, numberList, withErrors } from './_lib/core.js';

export default withErrors(async (request) => {
  if (request.method !== 'GET') return json({ erro: 'Método não permitido.' }, 405);
  const url = new URL(request.url);
  const date = url.searchParams.get('data');
  const professionalId = Number(url.searchParams.get('profissional_id'));
  const serviceIds = numberList(url.searchParams.getAll('servico_id'));
  if (!date || !serviceIds || !Number.isSafeInteger(professionalId) || professionalId <= 0) {
    return json({ erro: 'Informe data, profissional e serviços válidos.' }, 400);
  }
  const horarios = await availableTimes(date, professionalId, serviceIds);
  if (!horarios) return json({ erro: 'Profissional, data ou serviços inválidos.' }, 400);
  return json({ horarios });
});
