-- Adiciona a chave PIX do responsável (fretista/transportadora/frota própria)
-- ao espelho local erp_responsaveis. Preenchida na sincronização com o ERP,
-- a partir do contato 'PIX' de GKS.A_CADCCONT.
ALTER TABLE speedflow.erp_responsaveis
  ADD COLUMN IF NOT EXISTS pix text;

COMMENT ON COLUMN speedflow.erp_responsaveis.pix IS 'Chave PIX do responsável (contato PIX em GKS.A_CADCCONT).';
