ALTER TABLE public.nfes
  ADD COLUMN IF NOT EXISTS xml_conteudo text,
  ADD COLUMN IF NOT EXISTS volumes numeric,
  ADD COLUMN IF NOT EXISTS peso_liquido numeric,
  ADD COLUMN IF NOT EXISTS especie_volumes text,
  ADD COLUMN IF NOT EXISTS nsu bigint,
  ADD COLUMN IF NOT EXISTS xml_obtido_em timestamptz;

ALTER TABLE public.ctes
  ADD COLUMN IF NOT EXISTS xml_conteudo text;