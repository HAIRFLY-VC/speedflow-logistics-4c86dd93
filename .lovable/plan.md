# Frete Financeiro: falta publicar o fluxo

Sim — precisa publicar. O n8n guarda duas versões: a que você está editando e a que está publicada. Quando o aviso chega pelo webhook, ele executa **só a versão publicada**. É exatamente o que o histórico mostra: na execução de hoje 10:23 o aviso saiu do webhook e foi direto para "Buscar CT-e no Supabase", sem passar por nenhuma decisão de origem, e nenhum retorno ao app foi executado. Ou seja: a versão publicada ainda é a antiga, sem o desvio da rota.

## Passos

1. No fluxo "SpeedFlow - Frete Financeiro", clicar em **Publish** (topo direito).
2. Confirmar rapidamente, depois de publicar, que o desvio está ligado assim na versão publicada:
   - Webhook Fila Financeiro → "Origem é ROTA?"
   - saída **true** → "Criar Tarefa Bitrix (Rota)" → "Retorno ao App (Rota)"
   - saída **false** → "Buscar CT-e no Supabase" (caminho de CT-e intacto)
3. Me avisar. Eu reenvio a linha financeira da rota 414 e acompanho a execução até o fim.

## O que eu verifico depois do reenvio

- Se a execução entrou pelo caminho da rota (origem "ROTA").
- Se a tarefa foi criada no Bitrix com o título "#FRETE Rota M- ARCOMIX — SERGIO RICARDO ALMEIDA WANDERL", a descrição completa, prazo 01/10/2026 e responsável 30 (observadores 24, 54 e 1).
- Se o retorno chegou ao app e a tela "Envios desta rota" passou de "Pendente" para concluído com o link da tarefa.
- Se vier erro, mostro a mensagem exata devolvida pelo Bitrix e o ajuste necessário.

## Detalhes técnicos

- Condição do desvio: `{{ $json.body.payload.origem === "ROTA" }}`.
- Campos da tarefa: `payload.titulo_tarefa`, `payload.texto_tarefa`, `payload.data_pagamento`; RESPONSIBLE_ID 30, AUDITORS [24, 54, 1].
- Retorno: `POST /api/public/hooks/erp-fila-callback` com `{ fila: "financeiro", fila_id, ok, referencia_erp, erro }` + cabeçalho `x-webhook-token`.
- Linha a reenviar: `fila_provisionamento_financeiro` 689ae18c… (rota 414, PENDENTE) — remover e reinserir com `status: PENDENTE` e `ultimo_erro`/`processado_em` nulos dispara o gatilho `notify_fila_erp`.
