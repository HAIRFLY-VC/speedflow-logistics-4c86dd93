# Confirmar pagamento só com pedidos faturados + revisão antes de enviar

## O que muda para o usuário

1. **Regra de liberação do botão**: o botão "Confirmar Pgto" passa a exigir que **todos os pedidos da rota já estejam faturados** (com nota fiscal emitida), no lugar da regra de borderô. Enquanto faltar faturamento, o valor digitado continua visível e gravado como planejado, e o botão fica desabilitado com a mensagem "Aguardando faturamento de X de Y pedidos" (sem mãozinha no cursor).

2. **Tela de revisão ampliada**: ao clicar em "Confirmar Pgto", abre uma janela grande com o detalhamento completo da rota — pedidos agrupados por filial de faturamento, cliente, nota fiscal, valor da mercadoria e frete rateado, subtotal por filial e total geral.

3. **Valor editável na revisão**: nessa janela o usuário pode alterar o valor do frete; o rateio por pedido, os subtotais por filial e o texto que irá para a tarefa são recalculados na hora.

4. **Confirmação final**: nada é enviado enquanto o usuário não clicar no botão final de confirmação. Só então o app segue o fluxo já definido: grava o valor na rota, cria a ordem de pagamento, alimenta a fila de lançamento no ERP (por pedido) e a fila financeira com o texto da tarefa do Bitrix agrupado por filial.

5. O histórico de pagamentos da rota, os lançamentos adicionais restritos a administrador e o sinal âmbar "Definir valor do frete" continuam funcionando como hoje.

## Detalhes técnicos

- `src/lib/rota-pagamento.server.ts`: `dadosDeExpedicao` passa a trazer também `nro_nf` e `dt_fatur`; `agrupar` conta `pedidos_sem_faturamento` (pedido sem `nro_nf` no espelho `entregas_abertas`) além do borderô, e `PedidoPagamento` ganha `nro_nf`. `confirmarPagamentoRota` troca a trava de borderô por faturamento: recusa com "Ainda há N pedido(s) sem faturamento…".
- `src/lib/rota-pagamento.types.ts`: novos campos `nro_nf` em `PedidoPagamento` e `pedidos_sem_faturamento` em `PreviewPagamentoRota` (mantém `pedidos_sem_bordero` apenas como informação exibida).
- `src/components/routes/PagamentoRotaDialog.tsx`: `max-w-5xl` com corpo rolável; campo de valor editável no topo que refaz o preview (debounce curto, `previewPagamentoRota` com o novo valor); coluna de nota fiscal na tabela; aviso quando houver pedido sem faturamento; rodapé com "Cancelar" e o botão final "Confirmar e enviar" (verde), desabilitado enquanto faltar faturamento, valor ≤ 0 ou faltar permissão.
- `src/routes/_authenticated/rotas.index.tsx`: a query `["rotas-borderos"]` passa a ler `cod_pedido, bordero, nro_nf` e a montar a contagem de faturados; `FreightInput` usa essa contagem para habilitar o botão e para o texto "Aguardando faturamento de X de Y pedidos". Gravação do valor planejado no blur permanece.
- Sem mudanças de banco de dados nem na integração com ERP/Bitrix.

## Validação

`bunx tsgo --noEmit`, build, e checagem na tela `/rotas`: botão desabilitado com a nova mensagem, janela de revisão abrindo com o detalhamento, alteração do valor recalculando rateio e subtotais, e envio apenas após a confirmação final.
