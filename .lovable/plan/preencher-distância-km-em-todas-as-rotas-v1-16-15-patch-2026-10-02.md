# Preencher "Distância (km)" em todas as rotas (v1.16.15 — PATCH)

## Causa
A coluna da listagem calcula a distância usando apenas a coordenada gravada no próprio pedido. A maioria dos pedidos não tem essa coordenada, então a rota fica sem pontos e a célula mostra "—".
O mapa do detalhe da rota (que mostra 858,8 km na 461) usa mais fontes, nesta ordem:
1. coordenada do pedido;
2. localização do cliente pelo código ERP;
3. aproximação pelo bairro ou cidade do cliente.

Por isso só as rotas abertas no detalhe (ou com coordenada no pedido) têm distância.

## O que muda
- A listagem passa a localizar as entregas com a mesma regra do mapa do detalhe. Assim o número da coluna bate com o do mapa.
- Rotas sem distância gravada são calculadas sozinhas quando a tela abre, poucas por vez para não travar a tela nem estourar a cota do Google Maps. O valor fica gravado e não é recalculado nas próximas aberturas.
- O botão de recalcular da célula refaz a conta com a mesma regra.
- Quando parte das entregas foi localizada só por bairro ou cidade, aparece um "≈" discreto ao lado do número e uma dica explicando isso ao passar o mouse.
- Rotas sem nenhuma entrega localizável continuam com "—", com uma dica dizendo o motivo.

## Detalhes técnicos
- Criar um helper compartilhado (`src/lib/route-stops.ts`) que recebe os pedidos e devolve as paradas com coordenada e origem (pedido / cliente / bairro / cidade). Ele passa a ser usado por `RouteMapSection` (detalhe) e por `DistanceCell` (listagem), garantindo a mesma sequência de pontos.
- Em `RotasView.tsx`, carregar em lote para todas as rotas visíveis:
  - `customer_geo` pelos `erp_cod_cliente` (em páginas, por causa do limite de 1000 linhas);
  - UF/cidade/bairro (`listarPedidosDetalheRota`) só para pedidos ainda sem coordenada;
  - centroides (`localizarLocalidades`) para essas localidades.
- `DistanceCell` recebe as paradas já resolvidas; uma fila simples limita a 3 cálculos simultâneos via `computeRoutePolyline`, grava `routes.total_distance_km` e invalida a lista.
- Sem migração de banco e sem nova flag (regra do projeto: oficial = teste).
- Atualizar `src/config/version.ts` para 1.16.15 e o `CHANGELOG.md`.

## Checklist para publicar
- Testar no preview: abrir Rotas Pendentes e ver as rotas de 05/10 (435, 449, 455...) passarem de "—" para um número; abrir a rota 461 e conferir que a listagem e o mapa mostram o mesmo valor.
- Migrações: nenhuma.
- Atenção: as distâncias calculadas no preview ficam gravadas no banco compartilhado, então já aparecem na versão oficial.
- Reversão: voltar à versão anterior no histórico; os valores gravados podem ficar (só preenchem a coluna).
