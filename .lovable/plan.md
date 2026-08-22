# Substituir query do Sync ERP e vincular transportadora/fretista

## Objetivo
Trocar a SQL executada pelo botão **Sync ERP** pela query fornecida, que passa a trazer `R.COD_FRT_TRP` (código da transportadora/fretista no ERP) e redefine `R.NOME_MOTORISTA` como a razão social da transportadora/fretista.

## Escopo
1. **Atualizar a query** em `src/lib/erp-sync.server.ts` (`PENDING_ORDERS_SQL`).
2. **Tipar o novo campo** `COD_FRT_TRP` no tipo `ErpOrderRow`.
3. **Vincular a rota à transportadora/fretista** quando `COD_FRT_TRP` estiver preenchido:
   - Buscar em `transportadoras` onde `cod_erp = COD_FRT_TRP`.
   - Buscar o registro correspondente em `freight_carriers` via `transportadora_id`.
   - Preencher `routes.carrier_id` com o `freight_carriers.id` encontrado.
4. **Manter `driver_name`** preenchido com `R.NOME_MOTORISTA` (agora transportadora/fretista), preservando o comportamento atual da listagem de rotas.
5. **Tratar nulos**: quando `COD_FRT_TRP` ou `NOME_MOTORISTA` vierem nulos, a rota é criada/atualizada sem transportadora vinculada e sem nome no campo `driver_name`.

## Fora de escopo (não alterar)
- Schema do banco (as colunas `routes.carrier_id`, `transportadoras.cod_erp` e `freight_carriers.transportadora_id` já existem).
- Fluxo do n8n / aprovação de CT-e.
- Regras de geocodificação e demais etapas da sincronização.

## Arquivos envolvidos
- `src/lib/erp-sync.server.ts`

## Critérios de aceitação
- O botão Sync ERP executa a nova query exatamente como fornecida.
- Rotas vindas do ERP com `COD_FRT_TRP` preenchido são vinculadas à transportadora/fretista cadastrada no app pelo `cod_erp`.
- Rotas sem `COD_FRT_TRP` continuam sendo criadas/atualizadas normalmente.
- A sincronização não quebra quando `R.NOME_MOTORISTA` ou `R.COD_FRT_TRP` são nulos.
