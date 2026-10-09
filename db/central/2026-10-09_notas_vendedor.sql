-- v1.37.4: nome do vendedor comercial gravado no espelho do ERP.
-- Coluna nullable, retrocompatível com a versão publicada.
-- Reversão: alter table speedflow.notas_faturadas drop column if exists vendedor;
--           alter table speedflow.entregas_abertas drop column if exists vendedor;

ALTER TABLE speedflow.notas_faturadas ADD COLUMN IF NOT EXISTS vendedor text;
ALTER TABLE speedflow.entregas_abertas ADD COLUMN IF NOT EXISTS vendedor text;
