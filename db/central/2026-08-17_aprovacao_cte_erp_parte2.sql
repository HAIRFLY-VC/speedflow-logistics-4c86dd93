-- Parte 2: fila financeira, rateio por NF-e e configuração do n8n

-- 1) Fila de valores: uma linha por NF-e rateada
ALTER TABLE speedflow.fila_lancamento_erp_frete
  DROP CONSTRAINT IF EXISTS fila_lancamento_erp_frete_ordem_pagamento_id_key;

ALTER TABLE speedflow.fila_lancamento_erp_frete
  ADD COLUMN IF NOT EXISTS cte_id uuid REFERENCES speedflow.ctes(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS cod_filial text,
  ADD COLUMN IF NOT EXISTS nro_nf text,
  ADD COLUMN IF NOT EXISTS chave_nfe text,
  ADD COLUMN IF NOT EXISTS vlr_frete numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vlr_perna numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vlr_diaria numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vlr_pernoite numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vlr_reentrega numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vlr_descarrego numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS registro_erp jsonb;

CREATE INDEX IF NOT EXISTS fila_erp_ordem_idx
  ON speedflow.fila_lancamento_erp_frete (ordem_pagamento_id);

-- 2) Fila de provisionamento financeiro
CREATE TABLE IF NOT EXISTS speedflow.fila_provisionamento_financeiro (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ordem_pagamento_id uuid NOT NULL UNIQUE
    REFERENCES speedflow.ordens_pagamento_frete(id) ON DELETE CASCADE,
  cte_id uuid REFERENCES speedflow.ctes(id) ON DELETE CASCADE,
  payload jsonb NOT NULL,
  status speedflow.fila_erp_status NOT NULL DEFAULT 'PENDENTE',
  tentativas integer NOT NULL DEFAULT 0,
  ultimo_erro text,
  referencia_erp text,
  processado_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS fila_fin_status_idx
  ON speedflow.fila_provisionamento_financeiro (status, created_at DESC);

DROP TRIGGER IF EXISTS trg_fila_fin_updated_at ON speedflow.fila_provisionamento_financeiro;
CREATE TRIGGER trg_fila_fin_updated_at BEFORE UPDATE ON speedflow.fila_provisionamento_financeiro
  FOR EACH ROW EXECUTE FUNCTION speedflow.set_updated_at();

-- 3) Configuração: URL separada para o fluxo financeiro
ALTER TABLE speedflow.integracao_n8n
  ADD COLUMN IF NOT EXISTS webhook_url_financeiro text;

-- 4) Gatilho do n8n para a fila financeira
CREATE OR REPLACE FUNCTION speedflow.notify_fila_financeiro()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = speedflow, public, extensions AS $fn$
DECLARE cfg speedflow.integracao_n8n%ROWTYPE; url text;
BEGIN
  SELECT * INTO cfg FROM speedflow.integracao_n8n WHERE id = 1;
  url := coalesce(cfg.webhook_url_financeiro, '');
  IF cfg.ativo IS NOT TRUE OR url = '' THEN RETURN NEW; END IF;
  PERFORM net.http_post(
    url := url,
    headers := jsonb_build_object('Content-Type','application/json','X-Webhook-Token', coalesce(cfg.webhook_token,'')),
    body := jsonb_build_object('fila','financeiro','fila_id', NEW.id, 'payload', NEW.payload)
  );
  RETURN NEW;
END $fn$;

DROP TRIGGER IF EXISTS trg_fila_fin_notify ON speedflow.fila_provisionamento_financeiro;
CREATE TRIGGER trg_fila_fin_notify AFTER INSERT ON speedflow.fila_provisionamento_financeiro
  FOR EACH ROW EXECUTE FUNCTION speedflow.notify_fila_financeiro();

-- 5) Gatilho da fila de valores: identificar a fila no payload enviado
CREATE OR REPLACE FUNCTION speedflow.notify_fila_erp()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = speedflow, public, extensions AS $fn$
DECLARE cfg speedflow.integracao_n8n%ROWTYPE;
BEGIN
  SELECT * INTO cfg FROM speedflow.integracao_n8n WHERE id = 1;
  IF cfg.ativo IS NOT TRUE OR coalesce(cfg.webhook_url,'') = '' THEN RETURN NEW; END IF;
  PERFORM net.http_post(
    url := cfg.webhook_url,
    headers := jsonb_build_object('Content-Type','application/json','X-Webhook-Token', coalesce(cfg.webhook_token,'')),
    body := jsonb_build_object('fila','valores','fila_id', NEW.id, 'payload', NEW.payload)
  );
  RETURN NEW;
END $fn$;
