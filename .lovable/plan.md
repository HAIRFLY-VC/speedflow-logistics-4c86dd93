# Ajustar o fluxo "Frete Financeiro" para criar a tarefa das rotas de fretista

Hoje esse fluxo só sabe tratar CT-e: ele recebe o aviso, procura o CT-e correspondente, monta a tarefa e anexa o XML. Quando o aviso vem de uma rota de fretista (como a rota 414) não existe CT-e, o fluxo não encontra nada e a tarefa nunca é criada — a linha fica parada como "Pendente" e sem erro.

O aplicativo já manda tudo o que a tarefa precisa. Nada muda no aplicativo nem no banco; o ajuste é dentro do fluxo.

## O que o aplicativo já envia (rota 414, conferido agora)

- `origem`: "ROTA" (nos avisos de CT-e esse campo não vem)
- `titulo_tarefa`: "#FRETE Rota M- ARCOMIX — SERGIO RICARDO ALMEIDA WANDERL"
- `texto_tarefa`: descrição pronta com pedidos, notas, borderô, cliente, mercadoria, frete, subtotal por filial e a instrução de pagamento
- `data_pagamento`: "2026-10-01"
- `valor_total`: 700
- `rota` / `erp_route_id` / `route_id`, `responsavel_frete` (nome e código no ERP) e o detalhamento por filial

## Ajuste no fluxo

1. Logo depois do webhook, incluir um desvio (nó "Switch" ou "IF") que olha `origem` do aviso.
2. Caminho **CTE** (quando `origem` não for "ROTA"): segue exatamente como está hoje — busca do CT-e, montagem do texto, anexo do XML e criação da tarefa.
3. Caminho **ROTA**: pula a busca de CT-e e o anexo, indo direto para a criação da tarefa no Bitrix com:
   - Título: `titulo_tarefa`
   - Descrição: `texto_tarefa`
   - Prazo/vencimento: `data_pagamento`
   - Responsável: 30 — Observadores: 24, 54 e 1 (mesmos do caminho atual)
4. Os dois caminhos terminam no mesmo retorno que o fluxo já usa para avisar o aplicativo (sucesso com a referência da tarefa, ou erro com a mensagem), para que a tela "Envios desta rota" mostre a situação e o link da tarefa.

## Como vamos fazer

1. Monto o desvio e o nó de criação da tarefa em formato pronto para importar no n8n (um arquivo que você abre e cola/importa no fluxo "Frete Financeiro"), já preenchido com os campos acima e reaproveitando a credencial Bitrix que o fluxo usa.
2. Você importa/aplica no n8n.
3. Eu reenvio a linha financeira da rota 414 e acompanho até a tarefa ser criada, confirmando o título, a descrição, o prazo e o responsável — e mostro o link da tarefa.
4. Se o retorno vier com erro, mostro a mensagem exata devolvida pelo Bitrix e o ajuste necessário.

## Detalhes técnicos

- Aviso do aplicativo: `fila_provisionamento_financeiro` (linha 689ae18c… da rota 414, PENDENTE, 0 tentativas) → webhook `speedflow/frete-financeiro`.
- Retorno esperado: `POST /api/public/hooks/erp-fila-callback` com `{ fila: "financeiro", fila_id, ok, referencia_erp, erro }` e o cabeçalho `x-webhook-token` já usado hoje.
- Condição do desvio: `{{ $json.body.payload.origem === "ROTA" }}`; os campos da tarefa saem de `$json.body.payload.titulo_tarefa`, `.texto_tarefa`, `.data_pagamento`.
- Reenvio da linha financeira = remover e reinserir com `status: PENDENTE` e `ultimo_erro`/`processado_em` nulos (dispara o gatilho `notify_fila_erp`), ou o botão "Reenviar" na tela de autorização.
