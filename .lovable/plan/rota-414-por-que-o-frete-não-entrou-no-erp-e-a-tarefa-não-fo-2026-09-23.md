# Rota 414: por que o frete não entrou no ERP e a tarefa não foi criada

## O que foi verificado

A autorização da rota 414 (M- ARCOMIX, R$ 700,00) foi gravada em 22/09 às 21:55 e gerou:

- **2 lançamentos para o "Frete Valores"** (pedidos 4135181 = R$ 633,28 e 4135182 = R$ 66,72), ambos **recusados pelo ERP**: "Bind obrigatório ausente: nro_nf".
- **1 solicitação para o "Frete Financeiro"**, ainda **Pendente**, sem nenhuma tentativa registrada.

## Causa 1 — falta o número da nota no envio ao ERP

A gravação em GER_ENTREGAS é feita por **filial + nota fiscal + borderô**, mas o envio da rota manda apenas filial + pedido + borderô.

Correção no app: cada linha enviada passa a levar também o **número da nota fiscal** do pedido, buscado no espelho de entregas do ERP e, quando não estiver lá, consultado no ERP na hora. Como cada pedido tem sempre uma nota, continua uma linha por pedido, agora com filial + nota + borderô + pedido.

Além disso:

- A confirmação passa a exigir que **todos os pedidos tenham nota e borderô**, com mensagem dizendo quantos faltam — hoje o app deixa confirmar sem nota e o erro só aparece depois.
- A filial usada passa a ser a **filial de faturamento da nota**.

## Causa 2 — o fluxo financeiro só sabe tratar CT-e

O fluxo "SpeedFlow - Frete Financeiro" começa buscando o CT-e pela chave de acesso, a tabela de frete da transportadora e o XML para anexar. No pagamento de fretista não existe CT-e nem XML, então o fluxo não tem como seguir — por isso nenhuma tarefa foi criada.

O que muda de cada lado:

**No app** — a solicitação financeira passa a ser autossuficiente para rota, com tudo pronto para a tarefa: origem ("ROTA" ou "CTE"), título sugerido, responsável pelo frete (fretista), rota, valor total, data de pagamento, resumo por filial e o texto completo da tarefa. Nada que dependa de CT-e.

**No n8n (fluxo Frete Financeiro)** — logo após o webhook, um desvio por `payload.origem`:

- `CTE`: caminho atual, sem alteração (busca CT-e, tabela vigente, anexa XML).
- `ROTA`: caminho curto — monta a tarefa direto com os campos do payload (título `#FRETE Rota <nome> — <fretista>`, descrição = `payload.texto_tarefa`, vencimento = `payload.data_pagamento`, mesmos responsável e observadores), cria a tarefa no Bitrix24 e chama os mesmos callbacks de sucesso/erro.

Posso te entregar o passo a passo com os campos exatos de cada nó desse desvio; a alteração em si é feita no n8n.

## Acompanhamento e reenvio no app

- Na tela de autorização e no histórico da rota: situação real de cada envio (Pendente / Concluído / Erro), com o erro e a data.
- Botão **Reenviar** para itens com erro ou parados, tanto do ERP quanto do financeiro.
- Aviso "aguardando fluxo financeiro" quando a solicitação nunca recebe retorno, para não parecer que a tarefa foi criada.

## Reprocessar a rota 414

Depois do ajuste no app (e do desvio no n8n), a rota 414 é reenviada pelo botão **Reenviar**: os dois lançamentos vão com a nota fiscal e a solicitação financeira é redisparada. O histórico guarda as tentativas anteriores.

## Detalhes técnicos

- `src/lib/rota-pagamento.server.ts`: `dadosDeExpedicao` passa a expor `nro_nf`/`chave_nfe`/`cod_filial` da nota, com fallback consultando o ERP (`src/lib/frete-nfe-erp.server.ts`) para pedidos ausentes do espelho; as linhas de `fila_lancamento_erp_frete` gravam `nro_nf`/`chave_nfe` e o `payload` enviado ao n8n inclui `nro_nf` junto de `cod_filial`, `cod_pedido` e `bordero`; `confirmarPagamentoRota` bloqueia quando `pedidos_sem_faturamento > 0`.
- Payload da `fila_provisionamento_financeiro` (origem ROTA) ganha `titulo_tarefa`, `responsavel_frete` (nome/código do fretista) e mantém `texto_tarefa`, `data_pagamento`, `valor_total`, `filiais`.
- Reenvio: nova server function `reenviarItemFila({ fila, filaId })` com gate `pode_autorizar_frete`, que volta o item para `PENDENTE` e redispara os gatilhos `notify_fila_erp` / `notify_fila_financeiro`.
- UI: `src/routes/_authenticated/autorizar-pagamento-frete.tsx` e o histórico da rota mostram status/erro por linha e o botão de reenvio.
- Sem mudança de schema (as colunas `nro_nf`/`chave_nfe` já existem na fila de valores).
- Verificação: `bunx tsgo --noEmit`, reenvio da rota 414 e conferência dos registros da fila (status `CONCLUIDO` e referência do ERP/Bitrix).
