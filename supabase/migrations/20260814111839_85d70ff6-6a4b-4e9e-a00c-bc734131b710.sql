ALTER TABLE public.cte_ingest_logs
  ADD COLUMN IF NOT EXISTS cnpj_remetente text,
  ADD COLUMN IF NOT EXISTS nome_remetente text;

CREATE INDEX IF NOT EXISTS cte_ingest_logs_remetente_idx
  ON public.cte_ingest_logs (cnpj_remetente, created_at DESC);