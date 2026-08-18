# Configuração do workflow de CT-e/ERP no n8n

## Estado verificado no banco central

Consultei o banco central (esquema `speedflow`) e todas as tabelas da integração **já existem**:

- `ordens_pagamento_frete` — vazia
- `fila_lancamento_erp_frete` — vazia
- `fila_provisionamento_financeiro` — vazia
- `mapeamento_componentes_erp` — vazia (nenhum de-para cadastrado; o sistema usa as regras automáticas por nome)
- `integracao_n8n` — existe a linha `id = 1`, mas com `webhook_url`, `webhook_url_financeiro` e `webhook_token` em branco e `ativo = false`

Ou seja: não falta schema. Falta apenas **ligar** a integração — gerar o token, criar os dois workflows no n8n e preencher as URLs na tela de configuração.

O código do app já está pronto: aprovação (`CteAprovacaoPanel`), motor de rateio (`frete-aprovacao.server.ts`), gatilhos de banco que disparam o n8n a cada inserção nas filas, callback público (`/api/public/hooks/erp-fila-callback`) e o painel de monitoramento (`FilasErpPanel`).

## Como o fluxo funciona hoje

```text
Usuário aprova CT-e
   -> cria ordem em ordens_pagamento_frete
   -> insere 1 linha por NF-e em fila_lancamento_erp_frete
   -> insere 1 linha em fila_provisionamento_financeiro (1 por CT-e)
   -> trigger de banco chama o webhook do n8n (POST) com { fila, fila_id, payload }
   -> n8n lança no ERP Oracle
   -> n8n confirma em /api/public/hooks/erp-fila-callback
   -> status vira CONCLUIDO/ERRO e o CT-e vira LANCADO_ERP/ERRO_ERP
```

## Passo 1 — Gerar e gravar o token do webhook

Gerar um token aleatório forte e gravá-lo em `integracao_n8n.webhook_token` (banco central). Esse mesmo token é usado nas duas pontas:

- O banco envia no header `X-Webhook-Token` ao chamar o n8n (assim o n8n valida que a chamada veio do sistema).
- O n8n envia no header `x-webhook-token` ao chamar o callback do app.

## Passo 2 — Criar o workflow "Lançamento de valores" no n8n

Nós do workflow:

1. **Webhook** (POST) — copiar a Production URL gerada.
2. **IF / validação** — conferir o header `X-Webhook-Token` contra o token gerado; rejeitar se não bater.
3. **HTTP Request para a API Oracle** — chamar `POST {ERP_API_BASE_URL}/v1/query` com header `X-API-Key`, executando o UPDATE/INSERT dos valores em `gks.a_gerentregas`, usando os campos do payload.
4. **HTTP Request de callback** — `POST https://speedflow-logistics.lovable.app/api/public/hooks/erp-fila-callback` com header `x-webhook-token`.

Payload que o n8n recebe (dentro de `payload`):

```text
cod_filial, nro_nf, bordero, chave_nfe, chave_cte, numero_cte,
vlr_frete, vlr_perna, vlr_diaria, vlr_pernoite, vlr_reentrega, vlr_descarrego
```

Corpo do callback:

```json
{ "fila": "valores", "fila_id": "<id recebido>", "ok": true, "referencia_erp": "<id do lançamento>", "erro": null }
```

Em caso de falha no ERP, enviar `"ok": false` e o texto do erro em `"erro"`.

## Passo 3 — Criar o workflow "Provisionamento financeiro" no n8n

Mesma estrutura, mas gerando o título a pagar da transportadora.

Payload recebido:

```text
cod_filial, chave_cte, numero_cte, data_emissao, valor_total,
transportadora { razao_social, cnpj, pix, banco, agencia, conta },
notas [ { nro_nf, chave_nfe, bordero } ],
valores { os 6 campos }
```

Callback igual, mudando apenas `"fila": "financeiro"`.

## Passo 4 — Preencher as URLs no app

Na tela **Configurações de fretes > Lançamento no ERP**:

- Colar a URL do workflow de valores em "URL — lançamento de valores".
- Colar a URL do workflow financeiro em "URL — provisionamento financeiro".
- Ligar o switch "Ativo".
- Salvar.

## Passo 5 — Cadastrar o de-para de componentes (opcional)

A tabela `mapeamento_componentes_erp` está vazia, então hoje valem as regras automáticas:

| Componente do CT-e contém | Campo no ERP |
|---|---|
| REENTREG | vlr_reentrega |
| DESCARR / DESCARG | vlr_descarrego |
| DIARIA | vlr_diaria |
| PERNOITE / ESTADIA | vlr_pernoite |
| PERNA | vlr_perna |
| FRETE, GRIS, TAS, DESPACHO, PEDÁGIO, AD VALOREM, TDE, TRT, SEC CAT | vlr_frete |

Componentes fora dessas regras aparecem como "sem de-para" e **bloqueiam a aprovação** até serem cadastrados. Vale cadastrar exceções por transportadora conforme aparecerem.

## Passo 6 — Testar de ponta a ponta

1. Abrir um CT-e pendente e clicar em "Aprovar e lançar no ERP".
2. Conferir em **Pagamento de fretes** se as linhas entram nas filas como `PENDENTE`.
3. Ver a execução chegando no n8n.
4. Confirmar que o callback muda o status para `CONCLUIDO` e o CT-e para `LANCADO_ERP`.
5. Testar também um caso de erro para validar o caminho `ERRO` e o botão de reenvio manual.

## Ajustes no código previstos

- Adicionar na tela de configuração um campo/botão para **gerar e exibir o token do webhook**, hoje inexistente na UI (`LancamentoErpConfig` só edita as duas URLs e o switch).
- Exibir na mesma tela a **URL do callback** completa, pronta para copiar, em vez do caminho relativo atual.

Nenhuma migration é necessária.
