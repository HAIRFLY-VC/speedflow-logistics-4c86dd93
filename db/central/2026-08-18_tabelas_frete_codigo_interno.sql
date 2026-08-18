-- Código interno da tabela de frete (identificação independente da transportadora).
-- Executar no banco central (esquema speedflow).

ALTER TABLE speedflow.tabelas_preco_frete
  ADD COLUMN IF NOT EXISTS codigo_interno text;

UPDATE speedflow.tabelas_preco_frete
   SET codigo_interno = upper(regexp_replace(left(nome, 20), '[^a-zA-Z0-9]+', '-', 'g'))
 WHERE codigo_interno IS NULL;

NOTIFY pgrst, 'reload schema';
