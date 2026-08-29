# Excluir e reinserir rotas pendentes a cada sincronização do ERP

## Objetivo
Na sincronização (`syncErpOrders` em `src/lib/erp-sync.server.ts`), sempre excluir as rotas **pendentes** (status `planejada` ou `em_andamento` — ou seja, não finalizadas) e reinseri-las a partir do retorno da query do ERP. Rotas que não retornarem mais da query desaparecem do app; rotas `concluida` ou `cancelada` nunca são tocadas.

## Dados preservados
Antes de excluir, fazemos um snapshot de cada rota pendente e reaplicamos na rota recriada (casada por `erp_route_id` ou por `code`):
- `total_freight` (valor do frete definido pelo usuário)
- `total_distance_km` (quilometragem calculada)
- `carrier_id` (transportadora/fretista — só é sobrescrito se o ERP trouxer um responsável; caso contrário mantém o do snapshot)
- `status` e `notes`

## Fluxo na sincronização (src/lib/erp-sync.server.ts)

1. Após o retorno da query do ERP, buscar todas as rotas com status `planejada`/`em_andamento` no banco central.
2. Snapshot em memória: `id, erp_route_id, code, total_freight, total_distance_km, carrier_id, status, notes`.
3. Excluir dependências dessas rotas na ordem:
   - `route_orders` das rotas pendentes (delete por `route_id`).
   - `delivery_manifests` das rotas pendentes (delete por `route_id`) — necessário para não bloquear a exclusão da rota pela FK.
4. Excluir as rotas pendentes.
5. Processar os grupos da query como hoje (insert da rota + vínculos em `route_orders`), com uma diferença: ao recriar a rota, procurar no snapshot (por `erp_route_id` ou `code`) e reaplicar `total_freight`, `total_distance_km`, `status`, `notes` e `carrier_id` quando o ERP não trouxer `COD_FRT_TRP`.
6. Rotas pendentes que não voltarem da query ficam excluídas (comportamento desejado: o ERP é a fonte da verdade para rotas pendentes).

## Observações
- Entregas (`deliveries`) e recebimentos são vinculados a **pedidos**, não a rotas — não são afetados.
- Rotas `concluida`/`cancelada` e seus vínculos permanecem intactos, inclusive para exibição histórica.
- Se uma rota pendente tinha manifesto emitido, o manifesto é removido junto (a rota é recriada limpa; o manifesto pode ser reemitido).
- Nenhuma alteração de schema é necessária — apenas lógica no arquivo `src/lib/erp-sync.server.ts`.

## Arquivos
- `src/lib/erp-sync.server.ts` — snapshot, exclusão em cascata manual e restauração dos campos preservados no insert.
