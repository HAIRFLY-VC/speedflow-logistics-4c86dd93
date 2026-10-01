# Valor e peso na lista de entregas da rota — v1.16.1 (PATCH)

## O que muda
Na lista de entregas abaixo do mapa (detalhe da rota):
- Duas colunas novas, **Valor** e **Peso**, logo após "Pedido", com o valor (R$) e o peso (kg) de cada pedido.
- Na linha de cada entrega (cliente), aparece o total dos pedidos dela nessas mesmas colunas: valor somado, peso somado e quantidade de pedidos (ex.: "5 pedidos").
- Números alinhados à direita. Os pedidos sem localização seguem a mesma regra.

## Detalhes técnicos
- `src/routes/_authenticated/rotas.$routeId.tsx`: na tabela agrupada (cabeçalhos por volta da linha 930), adicionar as colunas `amount`/`weight`, que já estão disponíveis em cada item (linhas ~726/785). Na linha do grupo, deixar de usar uma única célula com colspan para o cliente e colocar os subtotais calculados com reduce. Usar `formatCurrency` e `weightFmt`.
- Versão 1.16.1 + CHANGELOG. Sem banco, sem flags.

## Checklist para publicar
- Preview: abrir uma rota com vários pedidos por cliente e conferir se os subtotais batem com o Resumo.
