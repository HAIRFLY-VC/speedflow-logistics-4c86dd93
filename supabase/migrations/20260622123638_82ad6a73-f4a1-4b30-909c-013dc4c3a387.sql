ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_address text,
  ADD COLUMN IF NOT EXISTS delivery_latitude numeric,
  ADD COLUMN IF NOT EXISTS delivery_longitude numeric;