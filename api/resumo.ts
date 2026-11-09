import { activeServices, json, numberList, readJson, withErrors } from './_lib/core.js';

export default withErrors(async (request) => {
  if (request.method !== 'POST') return json({ erro: 'Método não permitido.' }, 405);
  const body = await readJson(request);
  const ids = numberList(body?.['servicos']);
  if (!ids) return json({ erro: 'Selecione serviços distintos.' }, 400);
  const servicos = await activeServices(ids);
  if (!servicos) return json({ erro: 'Há serviços inválidos ou inativos.' }, 400);
  return json({
    servicos,
    valor_total: servicos.reduce((sum, service) => sum + Number(service.preco), 0).toFixed(2),
    duracao_total: servicos.reduce((sum, service) => sum + Number(service.duracao), 0),
  });
});
