# Rota 414: por que o frete não entrou no ERP e a tarefa não foi criada

## O que foi verificado

A autorização da rota 414 (M- ARCOMIX, R$ 700,00) foi gravada em 22/09 às 21:55 e gerou:

- **2 lançamentos para o ERP** (pedidos 4135181 = R$ 633,28 e 4135182 = R$ 66,72), ambos **com erro**: o ERP respondeu `Bind obrigatório ausente: nro_nf`.
- **1 solicitação financeira** (a que vira tarefa no Bitrix), ainda **Pendente**, sem nenhuma tentativa registrada.

## Causa 1 — falta o número da nota no envio ao ERP

A gravação em GER_ENTREGAS é feita por **filial + nota fiscal**, mas o envio da rota manda apenas filial + pedido. Por isso os dois lançamentos foram recusados.

Correção: cada linha enviada ao ERP passa a levar também o **número da nota fiscal** do pedido (e a chave, quando existir), buscada no espelho de entregas do ERP; quando a nota ainda não estiver disponível, o app consulta o ERP na hora. Como cada pedido tem sempre uma nota, continua uma linha por pedido.

Além disso:

- A confirmação passa a exigir que **todos os pedidos tenham nota**, com mensagem clara de quantos faltam — hoje o app deixa confirmar e o erro só aparece depois.
- A filial usada no lançamento passa a ser a **filial de faturamento da nota**, e não só a do pedido.

## Causa 2 — a tarefa do Bitrix nunca chegou a ser tentada

A solicitação financeira está Pendente com zero tentativas, ou seja: o pedido saiu do app, mas o fluxo que cria a tarefa no Bitrix não respondeu — provavelmente ainda não está publicado/ativo no n8n.

O que o app passa a fazer:

- Mostrar, na tela de autorização e no histórico da rota, a situação real de cada solicitação: **Pendente / Enviado / Concluído / Erro**, com o erro e a data.
- Botão **Reenviar** para qualquer item com erro ou parado, tanto do ERP quanto do financeiro.
- Aviso explícito "fluxo financeiro não configurado" quando o retorno nunca acontece, para não parecer que a tarefa foi criada.

Do lado do n8n, o fluxo financeiro precisa estar publicado e ativo e chamar o retorno do app ao terminar; sem isso o app registra a solicitação mas a tarefa não nasce. Posso te passar o formato exato que o fluxo recebe e o retorno esperado.

## Reprocessar a rota 414

Depois do ajuste, a rota 414 é reenviada pelo botão **Reenviar**: os dois lançamentos vão com a nota fiscal e a solicitação financeira é redisparada. O histórico guarda as tentativas anteriores.

## Detalhes técnicos

- `src/lib/rota-pagamento.server.ts`: `carregarPedidos`/`dadosDeExpedicao` passam a trazer `nro_nf`, `chave_nfe` e `cod_filial` da nota; fallback consultando o ERP (`src/lib/frete-nfe-erp.server.ts`) para pedidos sem espelho; as linhas de `fila_lancamento_erp_frete` gravam `nro_nf`/`chave_nfe`, e o `payload` enviado ao n8n inclui `nro_nf`; `confirmarPagamentoRota` bloqueia quando `pedidos_sem_faturamento > 0`.
- Reenvio: nova server function `reenviarItemFila({ fila, filaId })` com gate `pode_autorizar_frete`, que volta o item para `PENDENTE` e reinsere/atualiza para disparar o gatilho `notify_fila_erp` / `notify_fila_financeiro`.
- UI: `src/routes/_authenticated/autorizar-pagamento-frete.tsx` + histórico da rota mostram status/erro por linha e o botão de reenvio; rótulo "aguardando fluxo financeiro" quando `fila_provisionamento_financeiro` fica `PENDENTE` sem tentativas.
- Sem mudança de schema (as colunas `nro_nf`/`chave_nfe` já existem na fila de valores).
- Verificação: `bunx tsgo --noEmit`, reenvio da rota 414 e conferência dos registros da fila (status `CONCLUIDO` e referência do ERP).
