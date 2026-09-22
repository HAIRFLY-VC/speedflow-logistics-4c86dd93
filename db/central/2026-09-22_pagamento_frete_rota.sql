-- Confirmação de pagamento de frete por ROTA (tela "Rotas Pendentes").
-- Reaproveita as filas já consumidas pelo n8n (lançamento no ERP + Bitrix),
-- passando a aceitar ordens ligadas a uma rota (por pedido) e não só a CT-e.

-- 1) Ordens de pagamento agora podem nascer de uma rota.
ALTER TABLE speedflow.ordens_pagamento_frete
  ALTER COLUMN cte_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS route_id uuid REFERENCES speedflow.routes(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS tipo_pagamento text NOT NULL DEFAULT 'FRETE',
  ADD COLUMN IF NOT EXISTS motivo_adicional text,
  ADD COLUMN IF NOT EXISTS substituida_em timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ordens_pagamento_frete_origem_chk'
  ) THEN
    ALTER TABLE speedflow.ordens_pagamento_frete
      ADD CONSTRAINT ordens_pagamento_frete_origem_chk
      CHECK (cte_id IS NOT NULL OR route_id IS NOT NULL);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ordens_pagamento_frete_tipo_chk'
  ) THEN
    ALTER TABLE speedflow.ordens_pagamento_frete
      ADD CONSTRAINT ordens_pagamento_frete_tipo_chk
      CHECK (tipo_pagamento IN ('FRETE', 'ADICIONAL'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS ordens_pagamento_frete_route_idx
  ON speedflow.ordens_pagamento_frete (route_id, created_at DESC);

-- 2) Filas: vínculo com a rota e gravação por PEDIDO (rota não usa nota fiscal).
ALTER TABLE speedflow.fila_lancamento_erp_frete
  ADD COLUMN IF NOT EXISTS route_id uuid REFERENCES speedflow.routes(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS cod_pedido text,
  ADD COLUMN IF NOT EXISTS bordero text;

ALTER TABLE speedflow.fila_provisionamento_financeiro
  ADD COLUMN IF NOT EXISTS route_id uuid REFERENCES speedflow.routes(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS fila_lancamento_erp_frete_route_idx
  ON speedflow.fila_lancamento_erp_frete (route_id);
CREATE INDEX IF NOT EXISTS fila_provisionamento_financeiro_route_idx
  ON speedflow.fila_provisionamento_financeiro (route_id);

-- 3) Marcação da confirmação na própria rota.
ALTER TABLE speedflow.routes
  ADD COLUMN IF NOT EXISTS frete_confirmado_em timestamptz,
  ADD COLUMN IF NOT EXISTS frete_confirmado_por uuid;

GRANT SELECT, INSERT, UPDATE, DELETE ON speedflow.ordens_pagamento_frete TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON speedflow.fila_lancamento_erp_frete TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON speedflow.fila_provisionamento_financeiro TO authenticated;
GRANT ALL ON speedflow.ordens_pagamento_frete TO service_role;
GRANT ALL ON speedflow.fila_lancamento_erp_frete TO service_role;
GRANT ALL ON speedflow.fila_provisionamento_financeiro TO service_role;
