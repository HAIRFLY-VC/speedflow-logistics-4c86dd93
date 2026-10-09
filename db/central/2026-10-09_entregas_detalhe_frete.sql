-- v1.33.0: campos extras de GKS.A_GERENTREGAS para o detalhamento de
-- "Mercadorias faturadas" (Custo de Frete). Somente colunas novas e opcionais.
ALTER TABLE speedflow.entregas_abertas
  ADD COLUMN IF NOT EXISTS dt_etrg_trsp date,
  ADD COLUMN IF NOT EXISTS cod_transp_prn text,
  ADD COLUMN IF NOT EXISTS tipo_transp_pn text,
  ADD COLUMN IF NOT EXISTS vlr_frete numeric,
  ADD COLUMN IF NOT EXISTS vlr_perna numeric,
  ADD COLUMN IF NOT EXISTS vlr_diaria numeric,
  ADD COLUMN IF NOT EXISTS vlr_pernoite numeric,
  ADD COLUMN IF NOT EXISTS vlr_reentrega numeric,
  ADD COLUMN IF NOT EXISTS vlr_descarrego numeric;

NOTIFY pgrst, 'reload schema';

-- Reversão:
-- ALTER TABLE speedflow.entregas_abertas
--   DROP COLUMN IF EXISTS dt_etrg_trsp, DROP COLUMN IF EXISTS cod_transp_prn,
--   DROP COLUMN IF EXISTS tipo_transp_pn, DROP COLUMN IF EXISTS vlr_frete,
--   DROP COLUMN IF EXISTS vlr_perna, DROP COLUMN IF EXISTS vlr_diaria,
--   DROP COLUMN IF EXISTS vlr_pernoite, DROP COLUMN IF EXISTS vlr_reentrega,
--   DROP COLUMN IF EXISTS vlr_descarrego;
