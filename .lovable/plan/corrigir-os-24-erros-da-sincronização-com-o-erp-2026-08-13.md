# Corrigir os 24 erros da sincronização com o ERP

## O que está acontecendo

A última sincronização (hoje, 07:47) leu 28 pedidos: 4 foram atualizados e 24 falharam. Todos os 24 erros são idênticos:

`42P10 — there is no unique or exclusion constraint matching the ON CONFLICT specification`

Causa confirmada no banco: a gravação de clientes usa "inserir ou atualizar pelo código do ERP" (`ON CONFLICT (erp_id)`), mas o índice único de `erp_id` na tabela de clientes é **parcial** (`WHERE erp_id IS NOT NULL`). O Postgres não aceita esse índice como alvo de `ON CONFLICT` quando a condição não é informada — e a biblioteca usada não permite informá-la. Resultado: todo pedido cujo cliente ainda não existe no app falha; só passam os pedidos de clientes já cadastrados (os 4 atualizados).

## Correção

1. **Migração no banco:** substituir o índice único parcial de `erp_id` por um índice único simples sobre `erp_id` (valores nulos continuam permitidos e não conflitam entre si). Isso torna o `ON CONFLICT (erp_id)` válido.
2. **Reforço no código de importação** (`src/lib/erp-sync.server.ts`): manter o tratamento de conflito já existente e, caso a gravação por `erp_id` ainda falhe, buscar o cliente pelo código do ERP antes de descartar o pedido — assim um problema de índice nunca mais derruba a importação inteira.
3. **Verificação:** rodar uma sincronização de teste e confirmar 0 erros, com os 24 pedidos criados.

## Detalhes técnicos

- `DROP INDEX public.customers_erp_id_uidx;` seguido de `CREATE UNIQUE INDEX customers_erp_id_uidx ON public.customers (erp_id);` (não há duplicidades atuais, pois o índice parcial já as impedia).
- Nenhuma alteração de RLS ou de grants é necessária.
