-- Rotas: código do responsável (transportadora/fretista/frota) vindo do ERP.
-- Origem: A_GER_ROTAS.COD_FRT_TRP na sincronização do ERP.
ALTER TABLE speedflow.routes ADD COLUMN IF NOT EXISTS erp_carrier_code text;
COMMENT ON COLUMN speedflow.routes.erp_carrier_code IS 'Código do responsável pelo frete no ERP (COD_FRT_TRP).';
