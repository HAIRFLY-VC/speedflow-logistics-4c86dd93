ALTER TABLE public.routes ADD COLUMN IF NOT EXISTS erp_carrier_code text;
COMMENT ON COLUMN public.routes.erp_carrier_code IS 'Código COD_FRT_TRP do responsável pela rota no ERP.';