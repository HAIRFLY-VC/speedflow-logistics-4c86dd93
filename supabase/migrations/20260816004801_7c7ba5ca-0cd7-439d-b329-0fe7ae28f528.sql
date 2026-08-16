ALTER TABLE public.tabelas_preco_frete
  ADD COLUMN IF NOT EXISTS gris_minimo numeric NOT NULL DEFAULT 0;