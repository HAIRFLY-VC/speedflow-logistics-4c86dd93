
ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS depot_address text,
  ADD COLUMN IF NOT EXISTS depot_latitude numeric,
  ADD COLUMN IF NOT EXISTS depot_longitude numeric,
  ADD COLUMN IF NOT EXISTS max_route_weight_kg numeric NOT NULL DEFAULT 5000,
  ADD COLUMN IF NOT EXISTS max_route_value_brl numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS route_cluster_radius_km numeric NOT NULL DEFAULT 30;
