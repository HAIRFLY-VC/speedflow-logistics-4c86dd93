# Por que a rota 414 sumiu e como corrigir

## O que aconteceu

A rota 414 foi gravada como pendente às 21:24. Na sincronização das 21:30 ela, como esperado, não voltou mais do ERP e foi marcada como "Borderô emitido". Em seguida o app foi buscar o número do borderô dos dois pedidos com

`SELECT MAX(BORDERO) FROM GKS.A_GERENTREGAS WHERE COD_PEDIDO = ...`

e essa consulta **não retornou nenhuma linha** — os pedidos 4135181 e 4135182 ainda não existem nessa tabela. Pela regra combinada (pedido sem borderô é excluído da base), os dois pedidos e a rota foram apagados. Por isso a tela de autorização está vazia.

Confirmado no ERP agora:
- `GKS.A_GERENTREGAS` não tem linha para 4135181/4135182 (tem para pedidos vizinhos, como 4135183, borderô 32324).
- `ERP_PEDIDOS_EXPEDICAO_PENDENTE` tem os dois pedidos com **BORDERO = 32331** e data de saída 22/09/2026 19:51.

Ou seja: o borderô existe, só não está na tabela que estávamos consultando — provavelmente `A_GERENTREGAS` só é alimentada depois de outra etapa do processo.

## O que será feito

1. **Buscar o borderô nas duas fontes.** Primeiro em `ERP_PEDIDOS_EXPEDICAO_PENDENTE` (campos `BORDERO` e `DT_SAIDA_BORDERO`, por `PEDIDO`, em lote); o que não for encontrado ali é procurado em `GKS.A_GERENTREGAS` com o `MAX(BORDERO)` atual.
2. **Só excluir o pedido quando as duas consultas não trouxerem borderô.** Assim nenhum pedido é perdido por atraso de uma tabela.
3. **Se a consulta ao ERP falhar** (erro de conexão), nada é excluído nessa rodada: a rota fica marcada como borderô emitido e a busca é repetida na próxima sincronização.
4. **Recriar a rota 414** com os dois pedidos e rodar a sincronização de novo, para que ela apareça em "Autorizar pagamento de frete" com o borderô 32331 gravado.

## Detalhes técnicos

- `src/lib/erp-sync.server.ts`, função `tratarRotasComBorderoEmitido`: nova consulta em lote
  `SELECT PEDIDO, MAX(BORDERO) BORDERO FROM ERP_PEDIDOS_EXPEDICAO_PENDENTE WHERE PEDIDO IN (...) GROUP BY PEDIDO`
  executada antes da consulta em `GKS.A_GERENTREGAS`; os resultados são mesclados num único mapa pedido→borderô antes da gravação em `orders.bordero` e antes de decidir exclusões.
- A exclusão de `route_orders`/`orders` e a remoção de rotas vazias continuam iguais, apenas passam a usar o mapa combinado.
- Recriação da rota 414: script pontual no sandbox, igual ao usado antes (grava os pedidos com `bordero` nulo e a rota como pendente), seguido de uma sincronização para exercitar o fluxo completo.
- Sem mudanças de schema e sem mudanças nas telas.
