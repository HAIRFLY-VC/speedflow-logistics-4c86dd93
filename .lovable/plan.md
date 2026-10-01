# Rota nova some da lista após "Sync ERP" — v1.15.7 (PATCH)

## Causa
A sincronização lê no ERP somente as rotas **que têm pedidos pendentes**. Uma rota recém-criada (ainda sem pedidos) não volta nessa lista. A sincronização então entende que ela "saiu do ERP porque o borderô foi emitido" e a marca como borderô emitido — por isso ela deixa de aparecer em Rotas Pendentes. Ela não foi apagada: continua no banco, só marcada errado.

## Correção
1. Na sincronização, rota **sem nenhum pedido vinculado** não é mais tratada como "borderô emitido". Ela permanece pendente até receber pedidos.
2. Recuperar as rotas já afetadas: desmarcar o borderô emitido das rotas que não têm nenhum pedido (atualização pontual, apenas rotas vazias), para que voltem a Rotas Pendentes.
3. Atualizar versão para 1.15.7 e CHANGELOG ("Corrigido: rota recém-criada sem pedidos sumia após Sync ERP").

## Detalhes técnicos
- `src/lib/erp-sync.server.ts` (bloco "Reinserção de rotas pendentes", ~linha 1025): antes de colocar em `rotasComBorderoEmitido`, consultar `route_orders` das rotas candidatas e descartar as que têm 0 vínculos.
- Correção de dados no banco central (mostrada antes de executar, reversível):
  `update speedflow.routes set bordero_emitido_em = null where bordero_emitido_em is not null and not exists (select 1 from speedflow.route_orders ro where ro.route_id = routes.id) and erp_route_id is not null;`
  Reversão: regravar `bordero_emitido_em` nos IDs listados antes da atualização (serão salvos).
- Sem migração de estrutura, sem flags.

## Checklist para publicar
- Preview: criar rota, clicar Sync ERP, confirmar que continua em Rotas Pendentes.
- Confirmar que Autorizar pagamento continua ocultando rotas vazias.
- Publicar para que a versão oficial deixe de marcar rotas vazias.
