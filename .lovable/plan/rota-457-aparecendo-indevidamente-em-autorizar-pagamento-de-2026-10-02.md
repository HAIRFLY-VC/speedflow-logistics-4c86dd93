# Rota 457 aparecendo indevidamente em "Autorizar pagamento de frete"

## O que foi encontrado
- A rota 457 (05/10, sem fretista) tem 6 pedidos 10-FATURADO, mas **nenhum deles tem número de borderô**.
- Mesmo assim ela está marcada como "borderô emitido" desde 01/10 às 19:45.
- Quem marcou foi o Sync ERP: quando uma rota pendente deixa de vir na consulta de pedidos pendentes do ERP, o app assume que o borderô foi emitido e marca a rota, sem confirmar o número do borderô dos pedidos.
- A tela de Autorizar aceita a rota só com essa marca, mesmo sem borderô nos pedidos.

## O que muda (PATCH v1.16.12)
1. **Autorizar pagamento de frete** passa a mostrar só rotas em que **todos os pedidos têm número de borderô**. A marca automática sozinha não basta mais.
2. **Rotas Pendentes**: rota marcada como "borderô emitido" e ainda sem borderô em nenhum pedido continua em Rotas Pendentes (com o selo "Aguardando borderô") em vez de sumir.
3. **Rota 457**: limpar a marca errada no banco para ela voltar a Rotas Pendentes. Antes de fazer isso, vou listar as outras rotas na mesma situação (marcadas, mas sem borderô em nenhum pedido) e corrigir todas juntas.
4. Atualizar a versão e o CHANGELOG.

## Riscos
- Uma rota que tinha borderô de verdade no ERP, mas cujos números ainda não chegaram ao app (o ERP envia com atraso), só aparece em Autorizar depois que os números chegarem. Isso é o esperado.
- A correção do item 3 muda dados no banco compartilhado (vale para teste e produção): apaga a data da marca "borderô emitido" (`bordero_emitido_em`) só nas rotas sem nenhum borderô nos pedidos.

## Detalhes técnicos
- `autorizar-pagamento-frete.tsx`: o filtro passa a ser `erp_route_id && !sentinela && bordero.total > 0 && bordero.comBordero === bordero.total`.
- `rotas.index.tsx`: o filtro passa a ser `!bordero_emitido_em || bordero.comBordero === 0`.
- Correção dos dados: `update speedflow.routes set bordero_emitido_em = null where id in (...)` com os IDs confirmados. Para reverter, gravar de novo as datas originais, que serão guardadas antes.
- A lógica do Sync ERP fica como está: a busca do borderô por pedido continua.

## Checklist para publicar
- No teste: a rota 457 sai de Autorizar e aparece em Rotas Pendentes, e as rotas com borderô em todos os pedidos continuam em Autorizar.
- Publicar para valer na versão oficial. Para reverter: voltar à versão anterior pelo histórico e executar o SQL de reversão.
