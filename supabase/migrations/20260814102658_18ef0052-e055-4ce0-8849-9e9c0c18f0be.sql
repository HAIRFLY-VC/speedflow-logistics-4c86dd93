ALTER TABLE public.ctes
  ADD COLUMN IF NOT EXISTS tipo_cte smallint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS chave_cte_complementado text;

CREATE INDEX IF NOT EXISTS idx_ctes_chave_complementado
  ON public.ctes (chave_cte_complementado);