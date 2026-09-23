# Frete Financeiro: o desvio da rota ainda não está no fluxo

No histórico que você mandou, a execução de hoje 10:23 terminou como "Succeeded", mas o caminho percorrido foi o antigo: do webhook ela foi direto para "Buscar CT-e no Supabase". Não existe nenhum nó de decisão olhando a origem do aviso, e nenhum dos dois retornos ao app ("Callback Sucesso" / "Callback Erro") foi executado. É por isso que o envio da rota 414 continua "Pendente": o fluxo respondeu ao webhook, não achou CT-e algum e encerrou em silêncio.

Ou os três nós que eu enviei não foram importados, ou foram importados mas ficaram soltos, sem ligação com o webhook.

## O que precisa ser feito no n8n

1. Abrir o fluxo "SpeedFlow - Frete Financeiro" no Editor.
2. Importar (ou localizar, se já estiverem lá soltos) os nós:
   - "Origem é ROTA?"
   - "Criar Tarefa Bitrix (Rota)"
   - "Retorno ao App (Rota)"
3. Desfazer a ligação atual entre "Webhook Fila Financeiro" e "Buscar CT-e no Supabase".
4. Religar assim:
   - Webhook Fila Financeiro → "Origem é ROTA?"
   - saída **true** → "Criar Tarefa Bitrix (Rota)" → "Retorno ao App (Rota)"
   - saída **false** → "Buscar CT-e no Supabase" (todo o caminho de CT-e segue igual)
5. Nos nós novos, substituir os dois marcadores:
   - endereço do webhook do Bitrix: o mesmo já usado em "Criar Tarefa no Bitrix24"
   - token de retorno: o mesmo já usado em "Callback Sucesso - Financeiro"
6. Salvar e publicar o fluxo (o botão "Publish" no topo).

## Depois disso

Eu reenvio a linha financeira da rota 414 e acompanho a execução até o fim, confirmando: se ela entrou pelo caminho da rota, se a tarefa foi criada no Bitrix (com título, descrição, prazo 01/10/2026 e responsável 30) e se o retorno chegou ao app — e te mostro o link da tarefa.

Se preferir não mexer mais no n8n, existe uma alternativa: o próprio aplicativo cria a tarefa no Bitrix direto, sem passar pelo fluxo, quando a origem é rota de fretista. Nesse caso eu preciso do endereço do webhook do Bitrix para guardar como segredo do projeto. Me diga qual caminho você quer.

## Detalhes técnicos

- Arquivo com os nós prontos para importar: `n8n-frete-financeiro-rota.json` (Files).
- Condição do desvio: `{{ $json.body.payload.origem === "ROTA" }}`.
- Campos da tarefa: `payload.titulo_tarefa`, `payload.texto_tarefa`, `payload.data_pagamento`; RESPONSIBLE_ID 30, AUDITORS [24, 54, 1].
- Retorno: `POST /api/public/hooks/erp-fila-callback` com `{ fila: "financeiro", fila_id, ok, referencia_erp, erro }` e o cabeçalho `x-webhook-token`.
- Linha a reenviar: `fila_provisionamento_financeiro` 689ae18c… (rota 414, PENDENTE).
