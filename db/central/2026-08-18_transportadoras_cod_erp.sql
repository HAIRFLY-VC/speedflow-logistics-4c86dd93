-- Código da transportadora no ERP.
-- Executar no banco central (esquema speedflow).

ALTER TABLE speedflow.transportadoras
  ADD COLUMN IF NOT EXISTS cod_erp text;

COMMENT ON COLUMN speedflow.transportadoras.cod_erp IS
  'Código da transportadora no ERP (usado nos lançamentos de frete).';
