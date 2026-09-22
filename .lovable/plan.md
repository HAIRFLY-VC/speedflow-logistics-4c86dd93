# Confirmar pagamento de frete na tela Rotas Pendentes

## O que muda para o usuário

Na tela **Rotas Pendentes**, ao digitar o valor do frete de uma rota:

- O **% do frete** é recalculado na hora, enquanto digita (sem gravar nada).
- Um botão **Confirmar Pgto** aparece ao lado do campo. Nada é gravado até clicar nele.
- Ao clicar, abre uma **tela de detalhamento da rota**:
  - Pedidos ordenados por **filial de faturamento**, agrupados por filial.
  - Cada pedido mostra número, cliente, valor da mercadoria e o **valor do frete rateado** (proporcional ao valor da mercadoria).
  - No rodapé de cada grupo, o **subtotal do frete por filial**; no fim, o total geral.
  - Campo opcional de observação e um botão **Confirmar pagamento**.
- Após confirmar, a rota fica marcada como **pagamento confirmado** (o valor aparece travado na lista, com indicação visual).
- **Somente administradores** podem **reabrir**: alterar o valor e confirmar de novo (substitui o lançamento anterior), ou lançar um **valor adicional** escolhendo o motivo (pernoite, descarrego, dificuldade de entrega, reentrega, diária). Cada adicional gera seu próprio rateio e sua própria tarefa. Para os demais usuários, a rota confirmada fica somente leitura.

## Envio ao ERP e ao Bitrix

Ao confirmar, o app grava nas mesmas filas já usadas na aprovação de CT-e, que o n8n consome:

- **Fila de lançamento no ERP**: uma linha por pedido, com filial, número do pedido, e o valor rateado no campo correspondente (frete normal ou o campo do motivo escolhido no adicional).
- **Fila financeira**: uma linha por confirmação, com o texto da tarefa do Bitrix já montado — detalhamento da rota agrupado por filial de faturamento e, ao final, o **somatório proporcional do frete por filial**, para o financeiro pagar por filial.

## Detalhes técnicos

**Banco (migração em `db/central/`)**
- `ordens_pagamento_frete`: `cte_id` passa a aceitar nulo; novas colunas `route_id uuid` (FK `routes`), `tipo_pagamento text` (`FRETE` | `ADICIONAL`), `motivo_adicional text`. Check garantindo `cte_id IS NOT NULL OR route_id IS NOT NULL`.
- `fila_lancamento_erp_frete` e `fila_provisionamento_financeiro`: coluna `route_id uuid` (FK `routes`), `cte_id` já é nulo; `cod_pedido text` na fila de valores (rota grava por pedido, não por nota).
- `routes`: `frete_confirmado_em timestamptz`, `frete_confirmado_por uuid`.
- GRANTs mantidos como nas tabelas existentes.

**Server (`src/lib/rota-pagamento.server.ts` + `rota-pagamento.functions.ts`)**
- `montarPreviewPagamentoRota({ routeId, valor })`: lê rota + `route_orders(orders(order_number, cod_filial, total_amount, erp_cod_cliente))`, resolve razão social via espelho `clientes_erp`, agrupa por `cod_filial`, rateia `valor` por valor da mercadoria com `ratear()` no mesmo estilo de `frete-aprovacao.server.ts` (arredondamento a 2 casas, sobra no primeiro item) e devolve linhas + subtotais por filial.
- `confirmarPagamentoRota({ routeId, valor, tipo, motivo, observacao })`: `requireSupabaseAuth` + gate `pode_autorizar_frete`; grava `total_freight`, cria `ordens_pagamento_frete` (route_id, tipo), apaga lançamentos pendentes anteriores da mesma rota quando for reenvio de `FRETE`, insere as linhas na fila de valores e uma linha na fila financeira com `payload.texto_tarefa` pronto.
- Montagem do texto: bloco por filial (pedido, cliente, valor mercadoria, frete rateado), depois "Resumo por filial de faturamento" com o valor proporcional de cada uma e o total.

**UI (`src/routes/_authenticated/rotas.index.tsx` + `src/components/routes/PagamentoRotaDialog.tsx`)**
- `FreightInput` deixa de gravar no blur: mantém o valor local, o % recalcula em tempo real e o botão **Confirmar Pgto** abre o diálogo.
- Diálogo mostra o preview (agrupado por filial, subtotais), seletor de tipo (frete da rota / valor adicional + motivo), observação e confirmação; em caso de erro exibe mensagem em português via `mensagemErro`.
- Rotas já confirmadas mostram selo "Pgto confirmado" e o botão vira **Reabrir / Lançar adicional**.

**Verificação**: `bunx tsgo --noEmit`, `/rotas` respondendo 200, e conferência no app de uma rota com pedidos de mais de uma filial (soma dos rateios igual ao valor digitado).

## Histórico de solicitações de pagamento

- Nova aba/tela **Histórico de pagamentos** da rota (acessível pelo detalhamento e por um ícone na linha da rota) listando todas as solicitações: data/hora, quem confirmou, tipo (frete ou adicional + motivo), valor, situação no ERP e situação da tarefa.
- Cada linha traz um link **Abrir tarefa no Bitrix**, montado com `bitrixTaskUrl()` a partir da `referencia_erp` devolvida pelo n8n na fila financeira; quando a tarefa ainda não voltou, mostra "Aguardando criação da tarefa".
- Nada é apagado em reenvios: cada confirmação (inclusive as que substituem um lançamento anterior e os adicionais) permanece como um registro próprio em `ordens_pagamento_frete`, marcada como substituída quando for o caso.
- Técnico: consulta server-side `listarPagamentosDaRota(routeId)` juntando `ordens_pagamento_frete` (filtradas por `route_id`) com a fila financeira (`referencia_erp`, `status`, `ultimo_erro`) e a fila de valores (contagem de linhas e erros), ordenada por `created_at` desc.
