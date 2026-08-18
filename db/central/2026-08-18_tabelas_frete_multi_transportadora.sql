-- Uma tabela de preço de frete pode ser usada por mais de uma transportadora.
-- Executar no banco central (esquema speedflow). Já aplicado em 2026-08-18.

CREATE TABLE IF NOT EXISTS speedflow.tabelas_preco_frete_transportadoras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tabela_id uuid NOT NULL REFERENCES speedflow.tabelas_preco_frete(id) ON DELETE CASCADE,
  transportadora_id uuid NOT NULL REFERENCES speedflow.transportadoras(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tabela_id, transportadora_id)
);

CREATE INDEX IF NOT EXISTS idx_tpft_transportadora
  ON speedflow.tabelas_preco_frete_transportadoras(transportadora_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON speedflow.tabelas_preco_frete_transportadoras TO service_role;
GRANT ALL ON speedflow.tabelas_preco_frete_transportadoras TO postgres;

-- Backfill: mantém a transportadora "dona" atual como vínculo.
INSERT INTO speedflow.tabelas_preco_frete_transportadoras (tabela_id, transportadora_id)
SELECT id, transportadora_id FROM speedflow.tabelas_preco_frete
ON CONFLICT DO NOTHING;

NOTIFY pgrst, 'reload schema';
