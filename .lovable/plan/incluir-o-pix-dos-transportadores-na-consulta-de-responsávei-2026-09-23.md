# Incluir o PIX dos transportadores na consulta de responsáveis do ERP

## Objetivo

Passar a buscar o PIX de cada responsável (fretista / transportadora / frota própria) junto da
consulta de cadastro no ERP, guardar no espelho local `erp_responsaveis` e deixar o dado
disponível para as telas (hoje o PIX não é capturado em lugar nenhum).

## Como vai funcionar

1. **Nova consulta**: as duas queries de cadastro de responsáveis passam a ser exatamente a
   fornecida, com o campo PIX vindo de `GKS.A_CADCCONT` (contato 'PIX'):

   ```sql
   SELECT TRIM(T.DBA_TIP_CODIGO_1) COD_ERP,
          TRIM(T.DBA_TIP_RAZAO_SOCIAL) RAZAO_SOCIAL,
          T.DBA_TIP_NATUREZA COD_NAT,
          (SELECT MAX(TRIM(C.DBA_CONT_EMAIL))
             FROM GKS.A_CADCCONT C
            WHERE C.DBA_CONT_CODIGO = T.DBA_TIP_CODIGO_1
              AND C.DBA_CONT_CONTATO = 'PIX') PIX
     FROM GKS.A_CADCTIPO T
    WHERE T.DBA_TIP_NATUREZA IN ('ET','EF','EM')
   ```

   (O literal 'PIX' será comparado com `TRIM`/`UPPER` no código para não depender dos espaços
   fixos do campo — mesma seleção, mais tolerante.)
2. **Nova coluna `pix`** na tabela `erp_responsaveis` (script SQL em `db/central/` para rodar no
   banco central, como os anteriores).
3. **Sincronização passa a gravar o PIX**: tanto o Sync ERP quanto o botão "Atualizar cadastro"
   da tela de Transportadoras gravam/atualizam o PIX de cada responsável.
4. **Dado disponível nas telas**: o PIX passa a vir junto na listagem de responsáveis e na
   resolução do responsável da rota, pronto para ser usado (ex.: tela de pagamento de frete).

## Detalhes técnicos

- `src/lib/rota-erp.functions.ts`: substituir `SQL_CADASTRO_RESPONSAVEIS`; `salvarResponsaveis`
  passa a ler o campo `PIX` e incluí-lo no upsert; `listarResponsaveisErp` passa a selecionar e
  devolver `pix` (tipo `ResponsavelErp` ganha `pix: string | null`).
- `src/lib/erp-sync.server.ts`: substituir `RESPONSAVEIS_SQL` pela mesma consulta; o mapa de
  upsert do espelho ganha `pix`.
- `src/integrations/central/types.ts`: `ErpResponsavelRow` ganha `pix: string | null`.
- `src/lib/rota-responsavel.ts`: incluir `pix` no select do espelho e expor no retorno da
  resolução do responsável (sem alterar o que as telas exibem hoje).
- Nova migração `db/central/2026-09-23_erp_responsaveis_pix.sql`:
  `alter table speedflow.erp_responsaveis add column if not exists pix text;` + comentário.
  Você roda no banco central como fez com os scripts anteriores; eu aviso no final.
- O PIX aparecerá na próxima sincronização (Sync ERP ou "Atualizar cadastro"); registros sem
  contato PIX no ERP ficam com o campo vazio.
- Verificação: tsgo + build; depois forçar uma sincronização e conferir no banco se o PIX foi
  gravado para os responsáveis que o possuem.
