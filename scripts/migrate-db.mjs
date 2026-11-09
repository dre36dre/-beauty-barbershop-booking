import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import pg from 'pg';

const { Pool } = pg;
const connectionString = process.env.DATABASE_URL
  || process.env.POSTGRES_URL_NON_POOLING
  || process.env.POSTGRES_URL;

if (!connectionString) {
  throw new Error('Configure DATABASE_URL para executar as migrações PostgreSQL.');
}

const pool = new Pool({ connectionString, max: 1, connectionTimeoutMillis: 15_000 });
const client = await pool.connect();
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const defaultServices = [
  ['Corte', '50.00', 45, 'Corte personalizado feminino e masculino com acabamento profissional'],
  ['Coloração', '120.00', 90, 'Coloração completa e cobertura uniforme com produtos profissionais'],
  ['Escova', '45.00', 40, 'Lavagem especial, secagem e modelagem impecável dos fios'],
  ['Progressiva', '180.00', 120, 'Alinhamento térmico capilar de alta performance e brilho espelhado'],
  ['Botox / Selagem', '150.00', 90, 'Redução de volume e frizz com reposição profunda de massa capilar'],
  ['Soltura de Cachos', '140.00', 90, 'Definição natural, soltura e hidratação profunda para cabelos cacheados e crespos'],
  ['Tratamento', '80.00', 50, 'Cronograma capilar intensivo com nutrição, hidratação e reconstrução'],
  ['Luzes', '220.00', 150, 'Mechas e pontos de luz com técnica personalizada e clareamento seguro'],
  ['Design de Sobrancelhas', '35.00', 30, 'Desenho harmônico, alinhamento e valorização do olhar'],
];

try {
  await client.query('BEGIN');
  const schema = await readFile(path.join(root, 'database', 'schema.sql'), 'utf8');
  await client.query(schema);

  for (const [nome, preco, duracao, descricao] of defaultServices) {
    await client.query(
      `INSERT INTO servicos_servicos (nome, preco, duracao, descricao, ativo)
       SELECT $1::varchar, $2::numeric, $3::integer, $4::text, TRUE
        WHERE NOT EXISTS (
          SELECT 1 FROM servicos_servicos WHERE nome = $1::varchar
        )`,
      [nome, preco, duracao, descricao],
    );
  }

  const activeProfessional = await client.query(
    'SELECT 1 FROM barbeiros_barbeiro WHERE ativo = TRUE LIMIT 1',
  );
  if (!activeProfessional.rowCount) {
    await client.query(
      `INSERT INTO barbeiros_barbeiro (nome, ativo)
       SELECT 'Vanessa Souza', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM barbeiros_barbeiro WHERE nome = 'Vanessa Souza')`,
    );
    await client.query(
      `UPDATE barbeiros_barbeiro SET ativo = TRUE
        WHERE nome = 'Vanessa Souza' AND NOT EXISTS
          (SELECT 1 FROM barbeiros_barbeiro WHERE ativo = TRUE)`,
    );
  }

  await client.query('COMMIT');
  console.log('Node/PostgreSQL schema is ready.');
} catch (error) {
  await client.query('ROLLBACK').catch(() => undefined);
  throw error;
} finally {
  client.release();
  await pool.end();
}
