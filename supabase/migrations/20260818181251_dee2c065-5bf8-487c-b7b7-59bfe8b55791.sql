ALTER TABLE public.tabelas_preco_frete ADD COLUMN codigo_interno text;

UPDATE public.tabelas_preco_frete
SET codigo_interno = LEFT(LOWER(REGEXP_REPLACE(nome, '[^a-zA-Z0-9]', '', 'g')), 20)
WHERE codigo_interno IS NULL OR codigo_interno = '';
