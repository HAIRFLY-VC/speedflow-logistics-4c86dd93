## Problema

A tabela `route_orders` tem UNIQUE em `(route_id, order_id)`, mas não em `order_id` sozinho. Quando o ERP move um pedido de uma rota para outra (ex.: ERP-133 → ERP-153), o sync insere o novo vínculo mas **não remove o antigo**, deixando o pedido em duas rotas. Hoje há 6 pedidos duplicados (4130658, 4130659, 4130661, 4130662, 4130665, 4130702).

## Correção

### 1. Migração de banco
- Deduplicar `route_orders`: para cada `order_id` com mais de um vínculo, manter apenas o de maior `routes.route_date` (em empate, o mais recente por `route_orders.created_at`) e apagar os demais.
- Adicionar `UNIQUE (order_id)` em `route_orders` para impedir o problema no futuro.

### 2. Ajuste no sync do ERP (`src/lib/erp-sync.server.ts`)
No passo "Auto-cadastro de rotas", antes do `upsert` em `route_orders`:
- Para cada pedido do grupo, deletar quaisquer linhas em `route_orders` cujo `order_id` esteja na lista e `route_id` seja diferente do `routeId` atual.
- Manter o `upsert` existente para criar/atualizar o vínculo correto.

Isso garante que, quando o ERP reatribui um pedido a outra rota, o vínculo antigo é removido na próxima sincronização — e a constraint do banco passa a impedir o estado inválido mesmo em caminhos manuais.

### 3. Verificação
- Após a migração, rodar `SELECT order_id, COUNT(*) FROM route_orders GROUP BY 1 HAVING COUNT(*)>1` — deve retornar zero linhas.
- Sincronizar novamente com o ERP e confirmar que não surgem novos duplicados.
