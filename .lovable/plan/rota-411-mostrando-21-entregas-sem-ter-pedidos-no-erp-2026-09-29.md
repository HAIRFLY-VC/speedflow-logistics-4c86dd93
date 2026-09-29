# Rota 411 mostrando 21 entregas sem ter pedidos no ERP

## O que acontece hoje
A coluna "Qtd Entregas" conta os clientes distintos dos pedidos que o app tem vinculados à rota. Esses vínculos ficam gravados no app. Se a rota 411 mostra 21 entregas, o app ainda guarda pedidos vinculados a ela, embora o ERP não tenha nenhum. A causa exata ainda não foi confirmada.

## O que será feito
1. **Diagnóstico da rota 411**
   - Listar os pedidos que o app tem vinculados à rota 411 e comparar com o ERP.
   - Descobrir por que esses vínculos ficaram: se os pedidos saíram da rota no ERP ou se a rota foi desfeita.
2. **Correção dos dados**
   - Remover do app os vínculos da rota 411 que não existem no ERP. Nada muda no ERP.
   - Se o pagamento da rota já foi confirmado, não altero nada e apenas aviso você.
3. **Evitar que volte a acontecer**
   - A conferência com o ERP passa a valer também quando o ERP devolve a rota **sem nenhum pedido**. Hoje uma resposta vazia pode ser tratada como "não conferir".
   - A sincronização do ERP passa a limpar do app os vínculos de pedidos que saíram das rotas pendentes. Rotas com pagamento confirmado ficam de fora dessa limpeza.
4. **Validação**
   - A rota 411 passa a mostrar 0 pedidos e 0 entregas, ou deixa de aparecer, porque a listagem só mostra rotas com pedidos.
   - Conferir que outras rotas, como a 422, continuam corretas.

## Detalhes técnicos
- Contagem em `paradasOf` (`RotasView.tsx`) a partir de `route_orders` no banco central.
- Revisar a reconciliação (`rota-erp.functions.ts`) e o sync (`erp-sync.server.ts`) para tratar lista vazia de `gks.A_GER_ROTAS_PEDIDOS` como "rota sem pedidos". Só com consulta bem-sucedida: se o ERP falhar, não removo nada.
- Versão PATCH (v1.7.1) + CHANGELOG. Não há migração de estrutura. A limpeza de vínculos altera dados reais no banco compartilhado.
