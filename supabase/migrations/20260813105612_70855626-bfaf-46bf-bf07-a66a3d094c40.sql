DROP INDEX IF EXISTS public.customers_erp_id_uidx;
CREATE UNIQUE INDEX customers_erp_id_uidx ON public.customers (erp_id);