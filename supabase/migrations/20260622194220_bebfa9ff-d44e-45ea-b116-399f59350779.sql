WITH ranked AS (
  SELECT ro.id,
         row_number() OVER (
           PARTITION BY ro.order_id
           ORDER BY r.route_date DESC NULLS LAST, ro.created_at DESC
         ) AS rn
  FROM public.route_orders ro
  JOIN public.routes r ON r.id = ro.route_id
)
DELETE FROM public.route_orders ro
USING ranked
WHERE ro.id = ranked.id AND ranked.rn > 1;

ALTER TABLE public.route_orders
  DROP CONSTRAINT IF EXISTS route_orders_route_id_order_id_key;

ALTER TABLE public.route_orders
  ADD CONSTRAINT route_orders_order_id_key UNIQUE (order_id);