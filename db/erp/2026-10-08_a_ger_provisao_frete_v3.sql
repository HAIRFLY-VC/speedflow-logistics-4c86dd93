-- Provisionamento do custo de frete de rotas de transportadora (SpeedFlow).
-- Executar no Oracle do ERP com usuário dono do esquema GKS.
-- Uma linha por nota fiscal (filial + NF + borderô), com os mesmos campos de
-- valores da GKS.A_GERENTREGAS e a memória de cálculo em JSON (CLOB).
-- v3: sem trigger. O ID é informado pelo app, que consulta antes:
--     SELECT GKS.SEQ_PROVISAO_FRETE.NEXTVAL FROM DUAL

-- Se a sequência ou a tabela já existirem de tentativas anteriores,
-- descomente as duas linhas abaixo antes de rodar:
-- DROP TABLE GKS.A_GER_PROVISAO_FRETE;
-- DROP SEQUENCE GKS.SEQ_PROVISAO_FRETE;

CREATE SEQUENCE GKS.SEQ_PROVISAO_FRETE START WITH 1 INCREMENT BY 1 NOCACHE;

CREATE TABLE GKS.A_GER_PROVISAO_FRETE (
  ID               NUMBER        NOT NULL,
  ID_ROTA          NUMBER        NOT NULL,
  COD_FILIAL       NUMBER        NOT NULL,
  NRO_NF           NUMBER        NOT NULL,
  BORDERO          NUMBER        NOT NULL,
  COD_PEDIDO       NUMBER,
  COD_TRANSP       VARCHAR2(20),
  VLR_FRETE        NUMBER(15,2)  DEFAULT 0 NOT NULL,
  VLR_PERNA        NUMBER(15,2)  DEFAULT 0 NOT NULL,
  VLR_DIARIA       NUMBER(15,2)  DEFAULT 0 NOT NULL,
  VLR_PERNOITE     NUMBER(15,2)  DEFAULT 0 NOT NULL,
  VLR_REENTREGA    NUMBER(15,2)  DEFAULT 0 NOT NULL,
  VLR_DESCARREGO   NUMBER(15,2)  DEFAULT 0 NOT NULL,
  MEMORIA_CALCULO  CLOB,
  CHAVE_CTE        VARCHAR2(44),
  STATUS           CHAR(1)       DEFAULT 'A' NOT NULL,
  DT_PROVISAO      DATE          DEFAULT SYSDATE NOT NULL,
  USUARIO          VARCHAR2(100),
  CONSTRAINT PK_A_GER_PROVISAO_FRETE PRIMARY KEY (ID),
  CONSTRAINT CK_PROVISAO_FRETE_STATUS CHECK (STATUS IN ('A','S'))
);

COMMENT ON TABLE  GKS.A_GER_PROVISAO_FRETE IS 'Provisão do frete de rotas de transportadora calculada pela tabela de frete (SpeedFlow)';
COMMENT ON COLUMN GKS.A_GER_PROVISAO_FRETE.ID IS 'Preenchido pelo app com GKS.SEQ_PROVISAO_FRETE.NEXTVAL';
COMMENT ON COLUMN GKS.A_GER_PROVISAO_FRETE.MEMORIA_CALCULO IS 'JSON com tabela, praça, parâmetros e valores usados no cálculo';
COMMENT ON COLUMN GKS.A_GER_PROVISAO_FRETE.CHAVE_CTE IS 'Chave do CT-e emitido, para comparação futura';
COMMENT ON COLUMN GKS.A_GER_PROVISAO_FRETE.STATUS IS 'A = ativo, S = substituído por novo provisionamento';

CREATE INDEX GKS.IX_PROVISAO_FRETE_ROTA ON GKS.A_GER_PROVISAO_FRETE (ID_ROTA, STATUS);
CREATE INDEX GKS.IX_PROVISAO_FRETE_NF   ON GKS.A_GER_PROVISAO_FRETE (COD_FILIAL, NRO_NF, BORDERO);

-- ===================================================================
-- Comandos a cadastrar na API do ERP (/v1/execute/<nome>)
-- ===================================================================

-- insert_provisao_frete
-- binds: id (vindo de SELECT GKS.SEQ_PROVISAO_FRETE.NEXTVAL FROM DUAL),
--        id_rota, cod_filial, nro_nf, bordero, cod_pedido, cod_transp,
--        vlr_frete, vlr_perna, vlr_diaria, vlr_pernoite, vlr_reentrega,
--        vlr_descarrego, memoria_calculo (texto JSON -> CLOB), usuario
INSERT INTO GKS.A_GER_PROVISAO_FRETE
  (ID, ID_ROTA, COD_FILIAL, NRO_NF, BORDERO, COD_PEDIDO, COD_TRANSP,
   VLR_FRETE, VLR_PERNA, VLR_DIARIA, VLR_PERNOITE, VLR_REENTREGA, VLR_DESCARREGO,
   MEMORIA_CALCULO, USUARIO)
VALUES
  (:id, :id_rota, :cod_filial, :nro_nf, :bordero, :cod_pedido, :cod_transp,
   :vlr_frete, :vlr_perna, :vlr_diaria, :vlr_pernoite, :vlr_reentrega, :vlr_descarrego,
   :memoria_calculo, :usuario);

-- update_status_provisao
-- binds: status, id  (uma linha por vez; o app busca os IDs ativos da rota)
UPDATE GKS.A_GER_PROVISAO_FRETE
   SET STATUS = :status
 WHERE ID = :id;

-- Reversão:
-- DROP TABLE GKS.A_GER_PROVISAO_FRETE;
-- DROP SEQUENCE GKS.SEQ_PROVISAO_FRETE;
