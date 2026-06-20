ALTER TABLE public.orders ADD COLUMN erp_status text;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
