# Por que a rota 414 sumiu e como corrigir

## O que aconteceu

A rota 414 foi gravada como pendente às 21:24. Na sincronização das 21:30 ela, como esperado, não voltou mais do ERP e foi marcada como "Borderô emitido". Em seguida o app buscou o número do borderô dos dois pedidos com

`SELECT MAX(BORDERO) FROM GKS.A_GERENTREGAS WHERE COD_PEDIDO = ...`

e essa consulta **não retornou nenhuma linha** naquele momento. Pela regra combinada anteriormente, pedido sem borderô é excluído: os dois pedidos e a rota foram apagados. Por isso a tela de autorização está vazia.

Consultando agora (21:49), a mesma tabela **já retorna o borderô 32331** para os dois pedidos. Ou seja: o ERP só alimenta essa tabela alguns minutos depois; a exclusão imediata foi precipitada.

## O que será feito

1. **A busca continua só na `GKS.A_GERENTREGAS`**, com o `MAX(BORDERO)` por pedido, em lote.
2. **Nada é excluído na primeira tentativa.** A rota fica marcada como "Borderô emitido" e, a cada sincronização, o app tenta novamente buscar o número do borderô dos pedidos que ainda estão sem.
3. **Exclusão só depois de 5 dias** sem o ERP retornar borderô para o pedido (contados a partir do momento em que a rota foi marcada). Nesse caso o pedido sai da base e, se a rota ficar vazia, ela também é removida.
4. **Se a consulta ao ERP falhar**, nada é excluído nessa rodada.
5. **Recriar a rota 414** com os dois pedidos e rodar a sincronização, para que ela apareça em "Autorizar pagamento de frete" com o selo "Borderô emitido", aguardando o número.

## Como a tela fica

Rotas com borderô emitido aparecem em "Autorizar pagamento de frete" mesmo enquanto o número do borderô ainda não chegou; assim que o ERP disponibilizar, o número é gravado em cada pedido automaticamente na sincronização seguinte.

## Detalhes técnicos

- `src/lib/erp-sync.server.ts`, `tratarRotasComBorderoEmitido`: passa a rodar também para rotas **já marcadas** (`bordero_emitido_em` preenchido) que ainda tenham pedidos com `bordero` nulo, não só para as recém-marcadas.
- Exclusão condicionada a `bordero_emitido_em < agora - 5 dias`; antes disso, o pedido só é mantido aguardando.
- Erros da consulta ao ERP continuam registrados em `errors` sem derrubar a sincronização e sem excluir nada.
- `src/routes/_authenticated/autorizar-pagamento-frete.tsx` já aceita rotas com borderô emitido; nenhuma mudança de tela ou de schema é necessária.
- Recriação da rota 414: script pontual no sandbox (mesmo usado antes), seguido de uma sincronização para validar o fluxo.
