# Integração n8n — fluxo de valores ativo, financeiro pendente

## 1. Contrato do callback: confirmado

`POST /api/public/hooks/erp-fila-callback` (`src/routes/api/public/hooks/erp-fila-callback.ts`) já atende exatamente o que o n8n envia:

- valida `X-Webhook-Token` contra `integracao_n8n.webhook_token` (comparação de tempo constante);
- `fila: "valores"` → grava em `fila_lancamento_erp_frete`;
- sucesso (`ok: true`) → `status = CONCLUIDO`, `referencia_erp`, `processado_em`, `tentativas + 1`, `ultimo_erro = null`;
- erro (`ok: false`) → `status = ERRO`, `ultimo_erro = erro`;
- em seguida reavalia a `ordens_pagamento_frete` correspondente.

Nada a mudar no contrato.

## 2. Problema a corrigir: ordem/CT-e travam em "aguardando integração"

Hoje, ao aprovar um CT-e, o app grava **duas** filas: valores e financeiro. O callback só marca a ordem como `LANCADO_ERP` quando **todos** os itens das duas filas estão `CONCLUIDO`. Como o workflow financeiro ainda não existe, o item financeiro fica `PENDENTE` para sempre — então, mesmo com o lançamento de valores concluído no ERP, a ordem continua em `AGUARDANDO_INTEGRACAO_ERP` e o CT-e nunca vira `LANCADO_ERP`.

Correção: passar a considerar apenas as filas **habilitadas**. Enquanto `integracao_n8n.webhook_url_financeiro` estiver vazia (fluxo financeiro desligado), a conclusão da ordem e do CT-e passa a depender só da fila de valores; itens financeiros pendentes ficam ignorados no cálculo (e visíveis como "aguardando fluxo financeiro" na tela). Quando o workflow financeiro for publicado e a URL for preenchida, a regra volta a exigir as duas filas — sem novas mudanças de código.

Nenhum valor de `webhook_url`, `webhook_token` ou `ativo` será alterado.

## 3. Tela "Pagamento de fretes" — status por CT-e

Reformular o painel de filas (`FilasErpPanel`) para:

- agrupar por CT-e (número + chave), mostrando um status consolidado: Pendente / Processando / Concluído / Erro;
- por linha de NF-e: filial, nº NF, valor total enviado, status, tentativas, retorno do ERP (`referencia_erp`) ou `ultimo_erro`, e data de processamento;
- botão **Reenviar** habilitado somente quando `status = ERRO` (hoje aparece também em Pendente/Processando) — ele reinsere o registro, o que dispara o gatilho e o webhook de novo;
- ação "Reenviar todos com erro" no cabeçalho do CT-e;
- atualização automática a cada 15s enquanto houver item Pendente/Processando.

## 4. Aviso de que só o fluxo de valores está ativo

- Na tela de configuração de lançamento no ERP: badge por fluxo — "Valores: ativo" e "Financeiro: não configurado", com texto explicando que o provisionamento financeiro precisa ser feito manualmente por enquanto (estado derivado das URLs salvas, sem alterar nada no banco).
- No diálogo de aprovação/autorização do CT-e: aviso curto de que a aprovação lança apenas os valores no ERP.
- No painel de filas: seção financeira com rótulo "aguardando configuração do workflow" em vez de parecer erro.

## Detalhes técnicos

- `src/routes/api/public/hooks/erp-fila-callback.ts`: ajustar o cálculo de conclusão da ordem para ignorar a fila financeira quando `webhook_url_financeiro` estiver nula/vazia.
- `src/components/ctes/FilasErpPanel.tsx`: agrupamento por CT-e, regra do botão de reenvio, polling.
- `src/lib/frete-aprovacao.functions.ts` (`listarFilasErp`): incluir número/chave do CT-e e o estado do fluxo financeiro no retorno.
- `src/components/ctes/LancamentoErpConfig.tsx`: badges de status por fluxo.
