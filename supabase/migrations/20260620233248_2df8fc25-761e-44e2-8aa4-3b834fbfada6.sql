ALTER TABLE public.routes ADD COLUMN IF NOT EXISTS driver_name text;
ALTER TABLE public.routes ALTER COLUMN carrier_id DROP NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS route_orders_route_order_uniq ON public.route_orders(route_id, order_id);