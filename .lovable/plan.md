# Configuração do workflow de CT-e/ERP no n8n

## Contexto atual verificado

O app já tem toda a lógica de aprovação de CT-e e lançamento no ERP pronta em:

- `src/lib/frete-aprovacao.server.ts` — monta a prévia, cria a ordem de pagamento e insere nas filas.
- `src/lib/frete-aprovacao.functions.ts` — server functions expostas ao frontend.
- `src/components/ctes/CteAprovacaoPanel.tsx` — UI de aprovar/reprovar.
- `src/components/ctes/LancamentoErpConfig.tsx` — tela de configuração do n8n e de-para de componentes.
- `src/routes/api/public/hooks/erp-fila-callback.ts` — endpoint que o n8n chama para confirmar o processamento.
- `src/components/ctes/FilasErpPanel.tsx` — monitoramento das filas.

## Gap identificado

As tabelas usadas pelo motor centralizado ainda **não existem no banco central** (`speedflow`):

- `fila_lancamento_erp_frete`
- `fila_provisionamento_financeiro`
- `integracao_n8n`
- `mapeamento_componentes_erp`

Além disso, `ordens_pagamento_frete` existe apenas no `public` (banco local), mas o código de aprovação acessa via `centralDb` (schema `speedflow`). Antes de configurar o n8n, o schema precisa ser criado/migrado no banco central.

## Passo a passo do plano

### 1. Criar tabelas no banco central (speedflow)

Gerar uma migration que recria as tabelas no schema `speedflow`:

- `ordens_pagamento_frete` (com as colunas extras: `aprovacao_status`, `decidido_por`, `decidido_em`, `observacao`).
- `fila_lancamento_erp_frete` (com colunas de valores, payload, registro_erp, status, tentativas, etc.).
- `fila_provisionamento_financeiro` (com payload, status, tentativas, etc.).
- `integracao_n8n` (id=1, webhook_url, webhook_url_financeiro, webhook_token, ativo).
- `mapeamento_componentes_erp` (de-para por transportadora).

Aplicar `GRANT`, `ENABLE ROW LEVEL SECURITY`, políticas e triggers `set_updated_at` para cada tabela.

### 2. Configurar o webhook de callback no app

O endpoint `/api/public/hooks/erp-fila-callback` espera um token (`webhook_token` em `integracao_n8n` ou `CTE_INGEST_SECRET` como fallback). Após a migration:

- Gerar/guardar um token seguro em `integracao_n8n.webhook_token`.
- Informar esse token ao n8n para que ele envie no header `x-webhook-token` ao confirmar processamento.

### 3. Montar os dois workflows no n8n

Workflow 1: `frete-valores` (lançamento de valores no ERP por NF-e)

- Trigger: Webhook (URL a ser colada em `integracao_n8n.webhook_url`).
- Entrada: payload com `cod_filial`, `nro_nf`, `bordero`, `chave_nfe`, `chave_cte`, `numero_cte` e os campos `vlr_frete`, `vlr_perna`, `vlr_diaria`, `vlr_pernoite`, `vlr_reentrega`, `vlr_descarrego`.
- Ações: autenticar no ERP Oracle (via HTTP Request ou nó Oracle) e lançar os valores no borderô/nota.
- Retorno: chamar `POST /api/public/hooks/erp-fila-callback` com `fila=valores`, `fila_id`, `ok=true/false`, `referencia_erp` e `erro`.

Workflow 2: `frete-financeiro` (provisionamento financeiro da transportadora)

- Trigger: Webhook (URL a ser colada em `integracao_n8n.webhook_url_financeiro`).
- Entrada: payload com `cod_filial`, `chave_cte`, `numero_cte`, `data_emissao`, `valor_total`, dados da transportadora e lista de notas.
- Ações: criar o título/contas a pagar no ERP.
- Retorno: chamar o callback com `fila=financeiro`, `fila_id`, `ok` e referência.

### 4. Configurar a tela no app

Em `Configuração > Lançamento no ERP` (componente `LancamentoErpConfig`):

- Colar a URL do workflow de valores no campo "URL — lançamento de valores".
- Colar a URL do workflow financeiro no campo "URL — provisionamento financeiro".
- Ativar a integração.
- Cadastrar o de-para de componentes do CT-e para os campos do ERP (ou confiar nas regras automáticas).

### 5. Testar o fluxo end-to-end

- Escolher um CT-e em status `AUTORIZADO` ou `APROVADO`.
- Clicar em "Aprovar e lançar no ERP".
- Verificar se as linhas aparecem em `Filas de lançamento no ERP` com status `PENDENTE`.
- Disparar/verificar o n8n consumindo os webhooks.
- Confirmar que o callback atualiza o status para `CONCLUIDO` ou `ERRO` e o CT-e vai para `LANCADO_ERP` ou `ERRO_ERP`.

## Entregáveis

- Migration SQL no banco central com schema, grants, RLS e triggers.
- Dois workflows n8n funcionais (valores + financeiro) com retorno de callback.
- Webhook token configurado e salvo no banco.
- Configuração validada no app via tela de aprovação de CT-e.

## Nota sobre permissões

Apenas usuários com a permissão `pode_autorizar_frete` (perfis adm/gestor/operador com flag habilitada) conseguem aprovar. A configuração de webhooks e de-para é restrita a administradores.
