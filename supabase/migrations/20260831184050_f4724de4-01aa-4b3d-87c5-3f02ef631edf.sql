ALTER TABLE public.routes ADD COLUMN IF NOT EXISTS erp_status text;
COMMENT ON COLUMN public.routes.erp_status IS 'Status da rota no ERP (A_GER_ROTAS.STATUS).';