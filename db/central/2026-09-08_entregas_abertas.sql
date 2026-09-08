-- Espelho das entregas em aberto do ERP (GKS.A_GERENTREGAS, STATUS = 'A'):
-- notas fiscais já expedidas (DT_SAIDA preenchida) e ainda não entregues.
-- Alimentado pela sincronização do ERP; a tela "Entregas em aberto" lê daqui.
CREATE TABLE IF NOT EXISTS speedflow.entregas_abertas (
  nro_nf text NOT NULL,
  cod_pedido text NOT NULL,
  cod_cliente text,
  cod_vendedor text,
  cod_filial text,
  cod_agenda text,
  bordero text,
  dt_pedido date,
  dt_fatur date,
  dt_saida date,
  dt_entrega_cli date,
  dt_agendamento date,
  entrega_agend text,
  cod_transp_ent text,
  tipo_transp_ent text,
  placa_veiculo_ent text,
  valor numeric NOT NULL DEFAULT 0,
  peso numeric NOT NULL DEFAULT 0,
  tipos_ocorrencia text,
  status text,
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (nro_nf, cod_pedido)
);

CREATE INDEX IF NOT EXISTS entregas_abertas_dt_saida_idx ON speedflow.entregas_abertas (dt_saida);
CREATE INDEX IF NOT EXISTS entregas_abertas_cod_cliente_idx ON speedflow.entregas_abertas (cod_cliente);

COMMENT ON TABLE speedflow.entregas_abertas IS 'Notas fiscais expedidas e ainda não entregues (espelho de GKS.A_GERENTREGAS, STATUS = A).';

GRANT SELECT, INSERT, UPDATE, DELETE ON speedflow.entregas_abertas TO service_role;
GRANT SELECT ON speedflow.entregas_abertas TO authenticated;

-- Anotações do usuário por nota (ação / responsável / prazo). Preservadas
-- entre sincronizações.
CREATE TABLE IF NOT EXISTS speedflow.entregas_acoes (
  nro_nf text NOT NULL,
  cod_pedido text NOT NULL,
  acao text,
  responsavel text,
  prazo date,
  atualizado_por uuid,
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (nro_nf, cod_pedido)
);

COMMENT ON TABLE speedflow.entregas_acoes IS 'Ação / responsável / prazo anotados no app para cada entrega em aberto.';

GRANT SELECT, INSERT, UPDATE, DELETE ON speedflow.entregas_acoes TO service_role;
GRANT SELECT ON speedflow.entregas_acoes TO authenticated;
