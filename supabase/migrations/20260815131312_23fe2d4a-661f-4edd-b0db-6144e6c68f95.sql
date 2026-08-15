ALTER TABLE public.ctes
  ADD COLUMN IF NOT EXISTS numero_cte_complementado text,
  ADD COLUMN IF NOT EXISTS motivo_complemento text,
  ADD COLUMN IF NOT EXISTS observacoes jsonb NOT NULL DEFAULT '[]'::jsonb;