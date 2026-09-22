# Rotas com borderô emitido deixam de sumir

Hoje, quando o borderô é emitido no ERP, os pedidos param de voltar na consulta do Sync ERP e a rota é apagada do app (as rotas pendentes são excluídas e recriadas a cada sincronização). Por isso a tela "Autorizar pagamento de frete" fica vazia.

## O que muda

1. **A rota é preservada.** Na sincronização, só são apagadas e recriadas as rotas que ainda vêm do ERP. As que deixaram de vir são mantidas com seus pedidos e passam a ter o status **Borderô emitido**.
2. **Número do borderô buscado por pedido.** Para esses pedidos o app consulta o ERP com `select max(g.bordero) from gks.A_GERENTREGAS g where g.cod_pedido = ...` (em lote, vários pedidos por consulta) e guarda o número no pedido.
3. **Onde aparecem.** Rotas com borderô emitido saem de "Rotas Pendentes" e passam a ser listadas em **Autorizar pagamento de frete**, que deixa de depender apenas das entregas em aberto: mostra as rotas com borderô emitido e todos os pedidos com número de borderô.
4. **Depois do pagamento.** A rota continua na lista, com o selo de pagamento confirmado já existente.
5. **Selo na tela.** Novo selo "Borderô emitido" na coluna de status.

## Detalhes técnicos

Migração no banco central (script SQL para você executar):

- `ALTER TABLE speedflow.orders ADD COLUMN bordero text;`
- `ALTER TYPE public.route_status ADD VALUE IF NOT EXISTS 'bordero_emitido';` — se o tipo não aceitar alteração, alternativa equivalente: `ALTER TABLE speedflow.routes ADD COLUMN bordero_emitido_em timestamptz;` e o status derivado na tela.

`src/lib/erp-sync.server.ts`:

- O bloco de exclusão de rotas pendentes (linhas ~773-830) passa a calcular primeiro as chaves (`erp_route_id` / `code`) presentes no retorno do ERP; apaga `route_orders`, `delivery_manifests` e `routes` somente dessas; as demais recebem `status = 'bordero_emitido'` (ou a data no campo alternativo).
- Nova função `sincronizarBorderosDosPedidos(codPedidos)`: consulta
  `SELECT G.COD_PEDIDO, MAX(G.BORDERO) BORDERO FROM GKS.A_GERENTREGAS G WHERE G.COD_PEDIDO IN (:lista) GROUP BY G.COD_PEDIDO`
  em blocos de 300 pedidos e grava `orders.bordero`. Executada para os pedidos das rotas que mudaram para borderô emitido.
- Erros da consulta entram em `errors` sem derrubar a sincronização.

`src/components/routes/RotasView.tsx`:

- `borderoDaRota` passa a considerar, além de `entregas_abertas`, o campo `orders.bordero` dos pedidos da rota.
- `ROUTE_STATUS_LABEL` / `ROUTE_STATUS_TONE` ganham "Borderô emitido".
- Novo prop de filtro já existente é reutilizado pelas telas.

`src/routes/_authenticated/rotas.index.tsx`: filtro passa a excluir rotas com borderô emitido.

`src/routes/_authenticated/autorizar-pagamento-frete.tsx`: filtro passa a aceitar rotas com status "Borderô emitido" ou com todos os pedidos com borderô.

`src/integrations/central/types.ts`: `orders` ganha `bordero: string | null`; `routes.status` aceita o novo valor.

Sem mudanças no fluxo de confirmação de pagamento, nas filas do ERP/Bitrix ou nas permissões.
