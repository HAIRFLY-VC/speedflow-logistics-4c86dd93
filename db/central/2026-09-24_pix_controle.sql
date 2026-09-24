-- Controle do PIX usado em cada autorização de pagamento de frete por rota.
ALTER TABLE speedflow.ordens_pagamento_frete
  ADD COLUMN IF NOT EXISTS pix_utilizado text,
  ADD COLUMN IF NOT EXISTS favorecido_pix text,
  ADD COLUMN IF NOT EXISTS cod_responsavel_pix text;

CREATE INDEX IF NOT EXISTS ordens_pagamento_frete_cod_resp_pix_idx
  ON speedflow.ordens_pagamento_frete (cod_responsavel_pix, created_at DESC);

-- Liberações de troca de PIX feitas por administradores.
CREATE TABLE IF NOT EXISTS speedflow.pix_liberacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cod_erp text NOT NULL,
  pix_anterior text,
  pix_novo text NOT NULL,
  liberado_por uuid,
  liberado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pix_liberacoes_cod_idx
  ON speedflow.pix_liberacoes (cod_erp, liberado_em DESC);

GRANT SELECT ON speedflow.pix_liberacoes TO authenticated;
GRANT ALL ON speedflow.pix_liberacoes TO service_role;
ALTER TABLE speedflow.pix_liberacoes ENABLE ROW LEVEL SECURITY;
