# Selecionar as notas no lançamento de valor adicional

## O que muda para o usuário

Hoje, ao lançar um **valor adicional** (pernoite, descarrego, reentrega etc.), o valor é sempre rateado entre **todos** os pedidos/notas da rota, proporcionalmente à mercadoria. Nem sempre isso é correto: um pernoite ou uma reentrega costuma se referir a uma nota específica.

Passa a existir, apenas no modo **Valor adicional**, uma seleção de notas:

- Cada linha da tabela de pedidos ganha uma caixa de seleção (por pedido/nota fiscal), com "selecionar todas" no cabeçalho da filial.
- Ao entrar no modo adicional, todas as notas vêm marcadas (comportamento atual).
- O valor adicional é rateado **somente entre as notas marcadas**, pelo valor da mercadoria delas.
- Linhas não marcadas continuam visíveis, esmaecidas, com frete R$ 0,00, e ficam fora dos totais por filial e do resumo.
- O botão "Lançar adicional" fica desabilitado se nenhuma nota estiver marcada.
- O texto da tarefa do Bitrix e o lançamento no ERP passam a conter apenas as notas selecionadas.
- No modo **Frete da rota** nada muda: continua rateando entre todos os pedidos.

## Como será feito (técnico)

**`src/lib/rota-pagamento.types.ts`**
- `PreviewPagamentoRota` ganha `pedidos_selecionados: string[]` (códigos efetivamente considerados no rateio).

**`src/lib/rota-pagamento.server.ts`**
- `agrupar(...)` recebe `selecionados: Set<string> | null`. O rateio usa peso 0 para pedidos fora da seleção (frete 0) e mantém a linha no grupo; os totais por filial somam só o que foi rateado. Filiais que ficarem sem nenhuma nota selecionada saem da lista quando há seleção parcial.
- `montarPreviewPagamentoRota` e `confirmarPagamentoRota` aceitam `pedidos?: string[] | null`; quando `tipo === "ADICIONAL"` e a lista vem preenchida, ela é aplicada; caso contrário o comportamento é o de hoje.
- `montarTextoTarefa` lista apenas as linhas com frete > 0 quando há seleção parcial.
- As linhas enviadas ao ERP (`preview.filiais.flatMap(...)`) passam a ignorar pedidos com frete 0 em lançamento adicional, evitando gravar valor zero em notas não envolvidas.
- Validação: em adicional com seleção, os checks de borderô/nota fiscal consideram apenas os pedidos selecionados.

**`src/lib/rota-pagamento.functions.ts`**
- `previewPagamentoRota` e `confirmarPagamentoRotaFn` ganham `pedidos: z.array(z.string()).nullable().default(null)` no validador e repassam.

**`src/components/routes/PagamentoRotaDialog.tsx`**
- Estado `selecionados: Set<string>`, inicializado com todos os pedidos assim que o primeiro preview chega e resetado ao abrir o diálogo / trocar de tipo.
- A seleção entra na `queryKey` do preview (ordenada) e é enviada ao servidor apenas quando `tipo === "ADICIONAL"`.
- Coluna de checkbox na tabela de pedidos (visível só no modo adicional) + checkbox de "todas" por filial.
- Botão de envio desabilitado com seleção vazia, com aviso curto "Selecione ao menos uma nota".

## Verificação

- `bunx tsgo --noEmit` sem erros e build OK.
- Playwright em `/autorizar-pagamento-frete`: abrir uma rota já confirmada, escolher "Valor adicional", desmarcar uma nota e conferir que o rateio e o resumo por filial refletem só a nota marcada.
