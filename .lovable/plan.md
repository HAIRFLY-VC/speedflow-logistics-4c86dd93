# Listar apenas rotas com pedidos atrelados

## Objetivo

Na tela de Rotas, ocultar as rotas que não possuem nenhum pedido vinculado (as linhas que hoje aparecem com 0 paradas, R$ 0,00 e peso 0), exibindo somente rotas com pedidos.

## Mudança

- Em `src/routes/_authenticated/rotas.index.tsx`, após carregar as rotas com seus `route_orders`, filtrar fora as rotas sem nenhum pedido vinculado antes de ordenar e alimentar a tabela.
- Consequências automáticas: os totais por data (subtotais) e o total geral passam a considerar só as rotas com pedidos; datas que ficarem sem nenhuma rota deixam de aparecer.

## Detalhes técnicos

Filtro simples na `queryFn` da query `["routes"]`:

```text
rows = rows.filter(r => (r.route_orders ?? []).length > 0)
```

Nenhuma alteração de banco de dados, nenhuma mudança na criação/sincronização de rotas — apenas a exibição na listagem.
