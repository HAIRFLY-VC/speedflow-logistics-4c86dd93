# Atualizar query ERP e gravar CEP do cliente

## Mudanças

### 1. `src/lib/erp-sync.server.ts`
- Substituir `PENDING_ORDERS_SQL` pela nova query enviada, corrigindo o typo `E,CEP` → `E.CEP`.
- Adicionar `CEP: string | null` no tipo `ErpOrderRow`.
- No bloco de upsert de `customers`, incluir `zip_code: row.CEP` tanto no `insert` quanto no `update` (a coluna `zip_code` já existe na tabela `customers`).

## Não muda
- Schema do banco (coluna `zip_code` já existe em `customers`).
- Tabela `orders` (CEP fica em `customers`, não em `orders`).
- UI da listagem de pedidos.
