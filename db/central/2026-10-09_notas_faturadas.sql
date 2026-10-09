-- v1.34.0: espelho de TODAS as notas faturadas (qualquer status) dos ciclos
-- comerciais recentes (GKS.A_GERENTREGAS). Base do painel Custo de Frete.
CREATE TABLE IF NOT EXISTS speedflow.notas_faturadas (
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
  dt_etrg_trsp date,
  cod_transp_prn text,
  tipo_transp_pn text,
  vlr_frete numeric,
  vlr_perna numeric,
  vlr_diaria numeric,
  vlr_pernoite numeric,
  vlr_reentrega numeric,
  vlr_descarrego numeric,
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (nro_nf, cod_pedido)
);

CREATE INDEX IF NOT EXISTS notas_faturadas_dt_fatur_idx ON speedflow.notas_faturadas (dt_fatur);
CREATE INDEX IF NOT EXISTS notas_faturadas_cod_pedido_idx ON speedflow.notas_faturadas (cod_pedido);

GRANT SELECT, INSERT, UPDATE, DELETE ON speedflow.notas_faturadas TO service_role;
GRANT SELECT ON speedflow.notas_faturadas TO authenticated;

NOTIFY pgrst, 'reload schema';

-- Reversão:
-- DROP TABLE IF EXISTS speedflow.notas_faturadas;
