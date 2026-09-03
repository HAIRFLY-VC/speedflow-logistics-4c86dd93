-- Espelho local do cadastro de clientes do ERP. Alimentado pela sincronização
-- de pedidos (ERP_PEDIDOS_EXPEDICAO_PENDENTE), que já traz razão social, nome
-- de nota e endereço resumido. Usado para exibir o nome do cliente nas telas e
-- para identificar a praça (município) na estimativa de frete das rotas.
CREATE TABLE IF NOT EXISTS speedflow.clientes_erp (
  cod_cliente text PRIMARY KEY,
  razao_social text,
  nome_nf text,
  bairro text,
  cidade text,
  uf text,
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS clientes_erp_cidade_idx ON speedflow.clientes_erp (cidade);

COMMENT ON TABLE speedflow.clientes_erp IS 'Espelho do cadastro de clientes do ERP (código, razão social, cidade/UF).';
COMMENT ON COLUMN speedflow.clientes_erp.cod_cliente IS 'COD_CLIENTE no ERP.';

GRANT SELECT, INSERT, UPDATE, DELETE ON speedflow.clientes_erp TO service_role;
GRANT SELECT ON speedflow.clientes_erp TO authenticated;
