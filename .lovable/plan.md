# Auditoria de Fretes (CT-e) — Entrega 1: Schema

Vamos construir em 7 entregas, começando pelo banco de dados. Esta entrega cria toda a estrutura de dados, as regras de acesso e a permissão granular de autorização de pagamento. Nenhuma tela ainda.

## Ajuste de arquitetura (importante)

O projeto não usa Edge Functions — toda a lógica de servidor roda como server functions do TanStack Start (padrão de `erp.functions.ts` / `erp-sync.server.ts`), e webhooks externos entram por rotas em `src/routes/api/public/*`. Então:

- `parse-cte-xml` e `audit-cte` viram server functions (`src/lib/cte.functions.ts` + `cte-audit.server.ts`).
- `ingest_cte` vira uma rota pública preparada em `src/routes/api/public/hooks/ingest-cte.ts`, protegida por segredo dedicado, sem provedor conectado.
- `send-payment-order-to-erp` segue o mesmo padrão de stub já usado no ERP.

Isso não muda nada do schema; só onde o código vive.

## Entrega 1 — o que o SQL cria

**Cadastros**
- `empresas`: razão social, CNPJ (único), ativo.
- `transportadoras`: razão social, CNPJ (único), banco, agência, conta, pix, ativo.
- `freight_carriers` (fretistas): ganha `transportadora_id` opcional, sem quebrar dados existentes.

**Tabela de preço**
- `tabelas_preco_frete`: transportadora, nome, vigência (início/fim), tipo de cálculo (peso ou valor), percentual sobre valor, GRIS, ad valorem, pedágio, TAS, frete mínimo, ICMS, UF de destino opcional, ativo.
- `tabelas_preco_frete_faixas`: faixa de peso (de/até), valor por kg e valor fixo da faixa.
- Vigência validada por trigger (não por CHECK), conforme padrão do projeto.

**CT-e e auditoria**
- `ctes`: chave de acesso única de 44 caracteres, número, série, transportadora e empresa (nulos até identificar), data de emissão, valor do frete, valor da mercadoria, peso taxado, componentes em JSON, NFs referenciadas em JSON, caminho do XML no storage, origem da captura (MANUAL / SEFAZ_AUTO) e status.
- Enums novos: `cte_origem_captura`, `cte_status` (RECEBIDO, PENDENTE_IDENTIFICACAO, EM_AUDITORIA, APROVADO, DIVERGENTE, EM_RESOLUCAO, RESOLVIDO, AUTORIZADO, LANCADO_ERP, ERRO_ERP, REJEITADO), `cte_divergencia_status`, `ordem_pagamento_status`, `tabela_frete_tipo_calculo`.
- `cte_auditorias`: esperado, cobrado, diferença, percentual, detalhamento componente a componente em JSON, tolerância aplicada, resultado.
- `cte_divergencias`: motivo, observação do operador, valor acordado, status, quem resolveu e quando.
- `ordens_pagamento_frete`: valor autorizado, quem autorizou, status, payload enviado ao ERP, referência do ERP, mensagem de erro.
- `cte_status_historico`: preenchido automaticamente por trigger em toda mudança de status, no mesmo padrão de `order_status_history`.
- `configuracoes_auditoria_frete`: linha única com tolerância de R$ 5,00 e 1%.
- Bucket privado de storage `cte-xml` para os arquivos enviados.

**Permissões**
- `profiles.pode_autorizar_pagamento_frete` (padrão: falso).
- Função `pode_autorizar_frete(uuid)` que retorna verdadeiro para ADM ou para quem tem a flag ligada, seguindo o padrão seguro já usado em `has_role` / `is_staff`.

**Regras de acesso (RLS)**
- Toda tabela nova entra com RLS ligada e com as concessões de acesso obrigatórias.
- Equipe interna (adm, gestor, operador) lê e trabalha em CT-e, tabelas de preço, auditorias e divergências.
- Fretista não enxerga nada deste módulo.
- Criar ordem de pagamento e marcá-la como autorizada exige ADM ou a permissão granular; a mesma regra vale para os campos de autorização em `ctes`.
- Histórico de CT-e é somente leitura para a equipe (escrito apenas pelo gatilho).
- Cadastros de empresas, transportadoras e tabelas de preço: leitura para a equipe, escrita para ADM e gestor.

## Depois desta entrega

2. CRUD de Transportadoras e Tabela de Preço (com faixas e vigência).
3. Upload do XML + parsing + entrada pública preparada para DF-e.
4. Motor de auditoria + Central de Auditoria (lista e detalhe lado a lado).
5. Fluxo de divergência.
6. Autorização de pagamento + payload do ERP em stub.
7. Painel de divergências, configuração de tolerância e log de integração.

Cada uma para na sua revisão antes de seguir.
