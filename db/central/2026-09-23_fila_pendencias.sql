-- Fila de pendências de integração (lançamento no ERP e tarefa no Bitrix).
--
-- Cada item passa a ter uma hora marcada para a próxima tentativa automática,
-- pode ser pausado ou resolvido manualmente, e guarda o histórico completo de
-- tentativas para a tela "Pendências de integração".

-- 1) Controle de reenvio automático nas duas filas.
ALTER TABLE speedflow.fila_lancamento_erp_frete
  ADD COLUMN IF NOT EXISTS raiz_id uuid,
  ADD COLUMN IF NOT EXISTS proxima_tentativa_em timestamptz DEFAULT now() + interval '30 minutes',
  ADD COLUMN IF NOT EXISTS pausada_em timestamptz,
  ADD COLUMN IF NOT EXISTS resolvida_manual_em timestamptz,
  ADD COLUMN IF NOT EXISTS resolvida_manual_por uuid,
  ADD COLUMN IF NOT EXISTS resolvida_manual_motivo text;

ALTER TABLE speedflow.fila_provisionamento_financeiro
  ADD COLUMN IF NOT EXISTS raiz_id uuid,
  ADD COLUMN IF NOT EXISTS proxima_tentativa_em timestamptz DEFAULT now() + interval '30 minutes',
  ADD COLUMN IF NOT EXISTS pausada_em timestamptz,
  ADD COLUMN IF NOT EXISTS resolvida_manual_em timestamptz,
  ADD COLUMN IF NOT EXISTS resolvida_manual_por uuid,
  ADD COLUMN IF NOT EXISTS resolvida_manual_motivo text;

UPDATE speedflow.fila_lancamento_erp_frete SET raiz_id = id WHERE raiz_id IS NULL;
UPDATE speedflow.fila_provisionamento_financeiro SET raiz_id = id WHERE raiz_id IS NULL;

CREATE INDEX IF NOT EXISTS fila_erp_proxima_tentativa_idx
  ON speedflow.fila_lancamento_erp_frete (status, proxima_tentativa_em);
CREATE INDEX IF NOT EXISTS fila_fin_proxima_tentativa_idx
  ON speedflow.fila_provisionamento_financeiro (status, proxima_tentativa_em);

-- 2) Histórico de tentativas.
CREATE TABLE IF NOT EXISTS speedflow.fila_tentativas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fila text NOT NULL CHECK (fila IN ('valores', 'financeiro')),
  fila_id uuid NOT NULL,
  raiz_id uuid NOT NULL,
  tentativa integer NOT NULL DEFAULT 1,
  ok boolean NOT NULL DEFAULT false,
  mensagem text,
  origem text NOT NULL DEFAULT 'AUTOMATICA' CHECK (origem IN ('AUTOMATICA', 'MANUAL', 'CALLBACK')),
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS fila_tentativas_raiz_idx
  ON speedflow.fila_tentativas (raiz_id, criado_em DESC);

-- 3) Controle de avisos aos administradores (evita repetir o mesmo aviso).
CREATE TABLE IF NOT EXISTS speedflow.notificacoes_pendencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  canal text NOT NULL CHECK (canal IN ('EMAIL', 'WHATSAPP')),
  destinatario text NOT NULL,
  quantidade integer NOT NULL DEFAULT 0,
  assinatura text,
  ok boolean NOT NULL DEFAULT true,
  mensagem text,
  enviado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notificacoes_pendencias_envio_idx
  ON speedflow.notificacoes_pendencias (canal, destinatario, enviado_em DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON speedflow.fila_tentativas TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON speedflow.notificacoes_pendencias TO authenticated;
GRANT ALL ON speedflow.fila_tentativas TO service_role;
GRANT ALL ON speedflow.notificacoes_pendencias TO service_role;
