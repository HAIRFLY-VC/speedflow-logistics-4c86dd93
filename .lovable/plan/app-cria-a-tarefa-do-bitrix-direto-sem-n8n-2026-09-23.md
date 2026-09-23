# App cria a tarefa do Bitrix direto, sem n8n

Tiramos o n8n do caminho da tarefa financeira das rotas de fretista. Quando o pagamento da rota é confirmado, o próprio aplicativo cria a tarefa no Bitrix e grava o resultado, com link, na tela "Envios desta rota". O caminho dos CT-e continua exatamente como está hoje (segue pelo n8n).

## O que muda na prática

- Ao confirmar o pagamento de uma rota, a tarefa nasce no Bitrix na hora, com:
  - Título: "#FRETE Rota M- ARCOMIX — SERGIO RICARDO ALMEIDA WANDERL" (ou o título de pagamento adicional)
  - Descrição: o detalhamento por filial, pedidos, notas, borderô, cliente, mercadoria, frete e a instrução de pagamento
  - Prazo: a data de pagamento (hoje, 9 dias de paz)
  - Responsável 30 e observadores 24, 54 e 1
- Em "Envios desta rota", a linha do financeiro passa de "Pendente" para concluída com o link direto da tarefa; se der erro, aparece a mensagem devolvida pelo Bitrix e o botão "Reenviar" tenta de novo.
- Nada muda para os CT-e.

## O que eu preciso de você

O endereço do webhook de entrada do Bitrix (aquele que termina em `/rest/1/<token>/`, o mesmo usado hoje no fluxo do n8n). Vou pedir por um formulário seguro — ele fica guardado como segredo do projeto, nunca no código.

## Depois de guardado

Reenvio a linha financeira da rota 414 e confirmo a tarefa criada, mostrando o link, título, descrição, prazo e responsável.

## Detalhes técnicos

- Segredo novo: `BITRIX_WEBHOOK_URL` (webhook de entrada com permissão de tarefas).
- Novo módulo `src/lib/bitrix-task.server.ts`: `criarTarefaBitrix({ titulo, descricao, prazo })` → `POST {BITRIX_WEBHOOK_URL}/tasks.task.add` com `fields: { TITLE, DESCRIPTION, DEADLINE, RESPONSIBLE_ID: 30, AUDITORS: [24,54,1], GROUP_ID: 0 }`; retorna o id da tarefa ou a mensagem de erro do Bitrix (`error_description`).
- `confirmarPagamentoRota` (`src/lib/rota-pagamento.server.ts`): depois de inserir a linha em `fila_provisionamento_financeiro`, processa essa linha na hora — cria a tarefa e atualiza a linha para `CONCLUIDO` com `referencia_erp` = id da tarefa, ou `ERRO` com `ultimo_erro`, sempre incrementando `tentativas` e gravando `processado_em`.
- `reenviarFilaRota` (fila `financeiro`, origem ROTA): passa a chamar a mesma função em vez de reinserir a linha para o gatilho do n8n. Linhas de CT-e (`cte_id` preenchido) continuam no fluxo atual.
- `bitrixTaskUrl` em `src/lib/bitrix.ts` já monta o link a partir da referência — nada a mudar lá.
- O aviso "fluxo financeiro não configurado" em `PagamentoRotaDialog.tsx` passa a olhar a existência do segredo do Bitrix em vez de `webhook_url_financeiro`, via campo já exposto por `listarFilasRota`.
- `src/routes/api/public/hooks/erp-fila-callback.ts` continua intacto (ainda serve o fluxo de valores e os CT-e).
