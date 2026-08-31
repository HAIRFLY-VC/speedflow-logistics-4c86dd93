-- Rotas: status original vindo do ERP (A_GER_ROTAS.STATUS).
-- Necessário para a edição da capa da rota, que reenvia o status ao ERP.
ALTER TABLE speedflow.routes ADD COLUMN IF NOT EXISTS erp_status text;
COMMENT ON COLUMN speedflow.routes.erp_status IS 'Status da rota no ERP (A_GER_ROTAS.STATUS).';
