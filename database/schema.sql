CREATE TABLE IF NOT EXISTS clientes_cliente (
  id BIGSERIAL PRIMARY KEY,
  nome VARCHAR(100) NOT NULL,
  telefone VARCHAR(20) NOT NULL,
  "endereço" VARCHAR(255) NOT NULL,
  email VARCHAR(254) NOT NULL UNIQUE,
  cpf VARCHAR(11) UNIQUE
);

CREATE TABLE IF NOT EXISTS barbeiros_barbeiro (
  id BIGSERIAL PRIMARY KEY,
  nome VARCHAR(100) NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS barbeiros_horariotrabalho (
  id BIGSERIAL PRIMARY KEY,
  dia_semana INTEGER NOT NULL,
  hora_inicio TIME NOT NULL,
  hora_fim TIME NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  barbeiro_id BIGINT NOT NULL REFERENCES barbeiros_barbeiro(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS barbeiros_bloqueio (
  id BIGSERIAL PRIMARY KEY,
  data_inicio TIMESTAMPTZ NOT NULL,
  data_fim TIMESTAMPTZ NOT NULL,
  motivo VARCHAR(200) NOT NULL DEFAULT '',
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  barbeiro_id BIGINT NOT NULL REFERENCES barbeiros_barbeiro(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS servicos_servicos (
  id BIGSERIAL PRIMARY KEY,
  nome VARCHAR(100) NOT NULL,
  descricao TEXT NOT NULL DEFAULT '',
  preco NUMERIC(8,2) NOT NULL,
  duracao INTEGER NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS agendamentos_barbeiro (
  id BIGSERIAL PRIMARY KEY,
  nome VARCHAR(100) NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS agendamentos_servico (
  id BIGSERIAL PRIMARY KEY,
  nome VARCHAR(100) NOT NULL,
  descricao TEXT NOT NULL DEFAULT '',
  preco NUMERIC(8,2) NOT NULL,
  duracao INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS agendamentos_agendamento (
  id BIGSERIAL PRIMARY KEY,
  cliente_id BIGINT REFERENCES clientes_cliente(id) ON DELETE RESTRICT,
  profissional_id BIGINT REFERENCES barbeiros_barbeiro(id) ON DELETE RESTRICT,
  cliente_nome VARCHAR(100) NOT NULL,
  cliente_telefone VARCHAR(20) NOT NULL,
  barbeiro_id BIGINT NOT NULL REFERENCES agendamentos_barbeiro(id) ON DELETE CASCADE,
  data DATE NOT NULL,
  horario TIME NOT NULL,
  valor_total NUMERIC(8,2) NOT NULL DEFAULT 0,
  duracao_total INTEGER NOT NULL DEFAULT 0,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status VARCHAR(20) NOT NULL DEFAULT 'agendado'
);

CREATE TABLE IF NOT EXISTS agendamentos_agendamento_servicos (
  id BIGSERIAL PRIMARY KEY,
  agendamento_id BIGINT NOT NULL REFERENCES agendamentos_agendamento(id) ON DELETE CASCADE,
  servico_id BIGINT NOT NULL REFERENCES agendamentos_servico(id) ON DELETE CASCADE,
  UNIQUE (agendamento_id, servico_id)
);

CREATE TABLE IF NOT EXISTS agendamentos_agendamentoservico (
  id BIGSERIAL PRIMARY KEY,
  agendamento_id BIGINT NOT NULL REFERENCES agendamentos_agendamento(id) ON DELETE CASCADE,
  servico_id BIGINT NOT NULL REFERENCES servicos_servicos(id) ON DELETE RESTRICT,
  preco_contratado NUMERIC(8,2) NOT NULL,
  duracao_contratada INTEGER NOT NULL,
  CONSTRAINT unique_servico_agendamento UNIQUE (agendamento_id, servico_id)
);

CREATE INDEX IF NOT EXISTS agendamentos_agendamento_data_horario_idx
  ON agendamentos_agendamento (data, horario);
CREATE INDEX IF NOT EXISTS agendamentos_agendamento_profissional_data_idx
  ON agendamentos_agendamento (profissional_id, data, status);
CREATE INDEX IF NOT EXISTS barbeiros_horariotrabalho_profissional_dia_idx
  ON barbeiros_horariotrabalho (barbeiro_id, dia_semana, ativo);
CREATE INDEX IF NOT EXISTS barbeiros_bloqueio_periodo_idx
  ON barbeiros_bloqueio (barbeiro_id, data_inicio, data_fim, ativo);
