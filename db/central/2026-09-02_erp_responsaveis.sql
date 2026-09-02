-- Cadastro local (espelho) dos responsáveis do ERP: fretistas, transportadoras
-- e frota própria. Alimentado pela sincronização com o ERP (a_cadctipo) e usado
-- para exibir nome + código e o tipo (F/T/P) das rotas sem depender de consulta
-- online ao ERP a cada abertura de tela.
CREATE TABLE IF NOT EXISTS speedflow.erp_responsaveis (
  cod_erp text PRIMARY KEY,
  razao_social text,
  natureza text,
  tipo_frete text,
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS erp_responsaveis_razao_social_idx
  ON speedflow.erp_responsaveis (razao_social);

COMMENT ON TABLE speedflow.erp_responsaveis IS 'Espelho dos responsáveis do ERP (a_cadctipo): fretista, transportadora e frota própria.';
COMMENT ON COLUMN speedflow.erp_responsaveis.cod_erp IS 'DBA_TIP_CODIGO_1 no ERP.';
COMMENT ON COLUMN speedflow.erp_responsaveis.natureza IS 'DBA_TIP_NATUREZA bruta (EF, ET, EM, ...).';
COMMENT ON COLUMN speedflow.erp_responsaveis.tipo_frete IS 'Tipo derivado: F (fretista), T (transportadora), P (frota própria).';
