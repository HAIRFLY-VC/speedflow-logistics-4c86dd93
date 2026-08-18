# Guia: criar os dois workflows no n8n (CT-e → ERP)

Modelo escolhido: o banco central dispara o webhook. Ao aprovar um CT-e, o app grava nas filas; um gatilho no banco chama a URL do n8n. O n8n conversa com a **API HTTP do ERP** e devolve o resultado ao app pelo webhook de callback.

```text
Aprovar CT-e (app)
  └─ grava fila_lancamento_erp_frete (1 linha por NF-e)
  └─ grava fila_provisionamento_financeiro (1 linha por CT-e)
        │ gatilho no banco central (pg_net) POST + X-Webhook-Token
        ▼
   n8n Workflow 1 (Valores)      n8n Workflow 2 (Financeiro)
        └─ HTTP → API do ERP          └─ HTTP → API do ERP
        └─ POST callback do app       └─ POST callback do app
                 ▼
   fila = CONCLUIDO/ERRO, ordem e CT-e = LANCADO_ERP/ERRO_ERP
```

## O que eu faço no app

1. Script SQL em `db/central/` para o banco central:
   - habilita `pg_net`;
   - função `speedflow.notificar_n8n()` que lê `integracao_n8n` (URL de valores, URL financeira, token, flag `ativo`) e faz o POST do registro recém-inserido;
   - gatilhos `AFTER INSERT` em `fila_lancamento_erp_frete` e `fila_provisionamento_financeiro` (só dispara quando `status = 'PENDENTE'` e `ativo = true`).
2. Botão "Reenviar" já existente continua funcionando: ele reinsere a linha, o que dispara o webhook de novo.
3. Na tela de configuração, deixo visíveis: URL de callback, token, e um botão "Testar disparo" que envia um payload de exemplo para as duas URLs.

## O que você faz no n8n (passo a passo)

### Workflow 1 — `speedflow-frete-valores`
1. Novo workflow → nó **Webhook** (POST, path `speedflow/frete-valores`). Copie a Production URL.
2. Nó **IF / Code** de segurança: compare `{{$json.headers['x-webhook-token']}}` com o token do app (guarde o token numa credencial Header Auth ou variável do n8n). Se diferente → **Respond to Webhook** 401.
3. Nó **HTTP Request** → endpoint de lançamento de valores do ERP.
   - Corpo sugerido, vindo de `body.payload`: `cod_filial`, `nro_nf`, `bordero`, `chave_nfe`, `chave_cte`, `numero_cte` e os componentes (`vlr_frete`, `vlr_perna`, `vlr_diaria`, `vlr_pernoite`, `vlr_reentrega`, `vlr_descarrego`).
   - Autenticação: credencial Header Auth com a chave da API do ERP.
4. Dois nós **HTTP Request** de retorno (sucesso e erro, via `On Error → Continue`) para o callback do app:
   - URL: `https://<seu-app>/api/public/hooks/erp-fila-callback`
   - Header: `X-Webhook-Token: <token>`
   - Body sucesso: `{ "fila": "valores", "fila_id": "{{$json.body.id}}", "ok": true, "referencia_erp": "<id retornado pelo ERP>" }`
   - Body erro: `{ "fila": "valores", "fila_id": "...", "ok": false, "erro": "<mensagem>" }`
5. Ative o workflow e copie a Production URL.

### Workflow 2 — `speedflow-frete-financeiro`
Mesma estrutura, mudando:
- path do Webhook: `speedflow/frete-financeiro`;
- HTTP Request → endpoint de contas a pagar do ERP, usando `payload` com `cod_filial`, `chave_cte`, `numero_cte`, `data_emissao`, `valor_total`, `transportadora` (razão social, CNPJ, PIX/banco/agência/conta), `notas[]` e `valores`;
- callback com `"fila": "financeiro"`.

### Finalizar no app
1. Cole a URL de produção de cada workflow nos campos correspondentes da tela de configuração de lançamento no ERP.
2. Gere/copie o token e cadastre a mesma string no n8n.
3. Marque **Ativo** e salve.

## Teste end-to-end
1. "Testar disparo" → confirmar execução nos dois workflows do n8n.
2. Aprovar um CT-e real de valor baixo → conferir as execuções, o registro criado no ERP e as filas mudando para `CONCLUIDO`.
3. Forçar um erro (endpoint do ERP inválido) → conferir `ERRO`, `ultimo_erro` e o botão Reenviar.

## Detalhes técnicos
- Callback: `POST /api/public/hooks/erp-fila-callback`, header `X-Webhook-Token`, corpo `{ fila, fila_id, ok, referencia_erp, erro }`. Já implementado e valida o token contra `integracao_n8n.webhook_token`.
- A fila financeira tem 1 registro por CT-e; reprocessos substituem o anterior.
- Não é necessário dar acesso do n8n ao banco central neste modelo (o banco é quem chama o n8n); a única credencial nova no n8n é a da API do ERP.
