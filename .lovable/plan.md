# Substituir query de sincronização de rotas do ERP

Substituir a consulta `PENDING_ORDERS_SQL` em `src/lib/erp-sync.server.ts` pela versão fornecida pelo usuário.

## Mudança

A nova query remove o `CASE` que convertia `DT_PREV_EXP` nulo para as datas-sentinelas `01/01/3000` e `01/01/4000`, passando a retornar o valor bruto da coluna do ERP.

Query atual (trecho relevante):

```sql
CASE WHEN R.DT_PREV_EXP IS NULL THEN
     CASE WHEN R.NOME_ROTA IS NULL THEN TO_DATE('40000101','yyyyMMdd')
          ELSE TO_DATE('30000101','yyyyMMdd') END
     ELSE R.DT_PREV_EXP END DT_PREV_EXP
```

Query nova:

```sql
R.DT_PREV_EXP DT_PREV_EXP
```

Todo o restante da consulta permanece igual.

## Impacto esperado

- A sincronização passará a tratar `DT_PREV_EXP` como vem do ERP.
- O app continuará usando os sentinela `3000-01-01` e `4000-01-01` na exibição local, mas eles só aparecerão se já estiverem gravados no ERP.
- Nenhuma alteração de schema é necessária.
