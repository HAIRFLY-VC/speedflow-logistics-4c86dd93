CREATE SCHEMA IF NOT EXISTS speedflow;

DO $$ BEGIN
  CREATE TYPE speedflow.ordem_aprovacao_status AS ENUM ('PENDENTE','APROVADO','REPROVADO');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE speedflow.erp_campo_valor AS ENUM
    ('vlr_frete','vlr_perna','vlr_diaria','vlr_pernoite','vlr_reentrega','vlr_descarrego');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE speedflow.fila_erp_status AS ENUM ('PENDENTE','PROCESSANDO','CONCLUIDO','ERRO');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE OR REPLACE FUNCTION speedflow.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = speedflow, public AS $fn$
BEGIN NEW.updated_at = now(); RETURN NEW; END $fn$;

ALTER TABLE speedflow.ordens_pagamento_frete
  ADD COLUMN IF NOT EXISTS aprovacao_status speedflow.ordem_aprovacao_status NOT NULL DEFAULT 'PENDENTE',
  ADD COLUMN IF NOT EXISTS decidido_por uuid,
  ADD COLUMN IF NOT EXISTS decidido_em timestamptz,
  ADD COLUMN IF NOT EXISTS observacao text,
  ADD COLUMN IF NOT EXISTS erp_registro_selecionado jsonb;

ALTER TABLE speedflow.ordens_pagamento_frete
  DROP CONSTRAINT IF EXISTS opf_observacao_reprovado_chk;
ALTER TABLE speedflow.ordens_pagamento_frete
  ADD CONSTRAINT opf_observacao_reprovado_chk
  CHECK (aprovacao_status <> 'REPROVADO' OR coalesce(btrim(observacao),'') <> '');

CREATE TABLE IF NOT EXISTS speedflow.mapeamento_componentes_erp (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transportadora_id uuid REFERENCES speedflow.transportadoras(id) ON DELETE CASCADE,
  nome_componente_cte text NOT NULL,
  campo_erp speedflow.erp_campo_valor NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS mce_unq
  ON speedflow.mapeamento_componentes_erp
  (coalesce(transportadora_id,'00000000-0000-0000-0000-000000000000'::uuid), upper(btrim(nome_componente_cte)));

DROP TRIGGER IF EXISTS trg_mce_updated_at ON speedflow.mapeamento_componentes_erp;
CREATE TRIGGER trg_mce_updated_at BEFORE UPDATE ON speedflow.mapeamento_componentes_erp
  FOR EACH ROW EXECUTE FUNCTION speedflow.set_updated_at();

CREATE TABLE IF NOT EXISTS speedflow.fila_lancamento_erp_frete (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ordem_pagamento_id uuid NOT NULL UNIQUE
    REFERENCES speedflow.ordens_pagamento_frete(id) ON DELETE CASCADE,
  payload jsonb NOT NULL,
  status speedflow.fila_erp_status NOT NULL DEFAULT 'PENDENTE',
  tentativas integer NOT NULL DEFAULT 0,
  ultimo_erro text,
  referencia_erp text,
  processado_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS fila_erp_status_idx
  ON speedflow.fila_lancamento_erp_frete (status, created_at DESC);

DROP TRIGGER IF EXISTS trg_fila_erp_updated_at ON speedflow.fila_lancamento_erp_frete;
CREATE TRIGGER trg_fila_erp_updated_at BEFORE UPDATE ON speedflow.fila_lancamento_erp_frete
  FOR EACH ROW EXECUTE FUNCTION speedflow.set_updated_at();

CREATE TABLE IF NOT EXISTS speedflow.integracao_n8n (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  webhook_url text,
  webhook_token text,
  ativo boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO speedflow.integracao_n8n (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION speedflow.notify_fila_erp()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = speedflow, public, extensions AS $fn$
DECLARE cfg speedflow.integracao_n8n%ROWTYPE;
BEGIN
  SELECT * INTO cfg FROM speedflow.integracao_n8n WHERE id = 1;
  IF cfg.ativo IS NOT TRUE OR coalesce(cfg.webhook_url,'') = '' THEN
    RETURN NEW;
  END IF;
  PERFORM net.http_post(
    url := cfg.webhook_url,
    headers := jsonb_build_object('Content-Type','application/json','X-Webhook-Token', coalesce(cfg.webhook_token,'')),
    body := jsonb_build_object('fila_id', NEW.id, 'payload', NEW.payload)
  );
  RETURN NEW;
END $fn$;

DROP TRIGGER IF EXISTS trg_fila_erp_notify ON speedflow.fila_lancamento_erp_frete;
CREATE TRIGGER trg_fila_erp_notify AFTER INSERT ON speedflow.fila_lancamento_erp_frete
  FOR EACH ROW EXECUTE FUNCTION speedflow.notify_fila_erp();
