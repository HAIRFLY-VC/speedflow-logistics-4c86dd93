DO $$ BEGIN
  CREATE TYPE public.cte_tomador_papel AS ENUM ('REMETENTE','EXPEDIDOR','RECEBEDOR','DESTINATARIO','OUTROS');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.ctes
  ADD COLUMN IF NOT EXISTS tomador_cnpj text,
  ADD COLUMN IF NOT EXISTS tomador_nome text,
  ADD COLUMN IF NOT EXISTS tomador_papel public.cte_tomador_papel;