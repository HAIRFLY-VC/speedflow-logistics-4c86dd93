-- 1) Garantir coluna erp_id em products ANTES de criar índice
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS erp_id text;

-- 2) Índices únicos parciais
CREATE UNIQUE INDEX IF NOT EXISTS orders_erp_id_uidx
  ON public.orders (erp_id) WHERE erp_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS customers_erp_id_uidx
  ON public.customers (erp_id) WHERE erp_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS products_erp_id_uidx
  ON public.products (erp_id) WHERE erp_id IS NOT NULL;

-- 3) Tabela de auditoria
CREATE TABLE IF NOT EXISTS public.erp_sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  trigger text NOT NULL CHECK (trigger IN ('manual','cron')),
  triggered_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  orders_fetched integer NOT NULL DEFAULT 0,
  orders_created integer NOT NULL DEFAULT 0,
  orders_updated integer NOT NULL DEFAULT 0,
  orders_skipped integer NOT NULL DEFAULT 0,
  customers_created integer NOT NULL DEFAULT 0,
  errors jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running','success','partial','failed'))
);

GRANT SELECT ON public.erp_sync_runs TO authenticated;
GRANT ALL ON public.erp_sync_runs TO service_role;

ALTER TABLE public.erp_sync_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "erp_sync_runs_admin_select"
  ON public.erp_sync_runs FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'adm'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));

CREATE INDEX IF NOT EXISTS erp_sync_runs_started_idx ON public.erp_sync_runs (started_at DESC);