# Peso no "Confirmar pagamento" — v1.16.10 (PATCH)

## O que muda
No modal **Confirmar pagamento** (lápis em "Autorizar pagamento de frete" e "Pagamento de CT-e"):
- Linha de totais do topo passa a mostrar também o **peso total** da rota, junto de "9 pedido(s)" (ex.: "9 pedido(s) · 12.345,6 kg").
- Na tabela por filial, coluna nova **Peso** em cada linha de pedido (kg, alinhada à direita).
- No cabeçalho de cada filial, além do valor do frete, aparece o **peso somado** dos pedidos da filial.

## De onde vem o peso
O campo já existe no banco do app (`orders.weight`, o mesmo usado na tabela de entregas abaixo do mapa e no card de pedidos pendentes). Nenhuma consulta nova ao ERP, nenhuma migração.

## Detalhes técnicos
- `src/lib/rota-pagamento.server.ts`:
  - `carregarPedidos`: incluir `orders.weight` no `select` e no tipo `PedidoCarregado`.
  - `agrupar`: somar peso por pedido (só quando incluído na seleção, mesma regra do valor) e devolver `pesoTotal`; acrescentar `peso` ao `FilialPagamento`.
- `src/lib/rota-pagamento.types.ts`: `PedidoPagamento.peso`, `FilialPagamento.peso`, `PreviewPagamentoRota.peso_total`.
- `src/components/routes/PagamentoRotaDialog.tsx`: totais do topo, coluna Peso (entre Mercadoria e Frete) e subtotal no cabeçalho da filial. Formatação igual ao detalhe da rota (`Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 })` + " kg").
- `src/config/version.ts` → 1.16.10 + entrada no `CHANGELOG.md`.

## Riscos e reversão
- Risco baixo: só leitura/apresentação. Nada é gravado no app, no ERP ou no Bitrix.
- Reverter: versão anterior no histórico.

## Checklist para publicar
- Preview: abrir o lápis de uma rota com pedidos e conferir peso total no topo, peso por pedido e subtotal por filial.
- Migrações: nenhuma. Flags: nenhuma.
- Publicar para valer na versão oficial.
