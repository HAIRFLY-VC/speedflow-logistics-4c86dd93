# Identificação do Tomador do Serviço no CT-e

Hoje a empresa responsável pelo CT-e é resolvida pelo CNPJ do remetente ou do destinatário. Passa a ser resolvida pelo **tomador** declarado no XML (`ide/toma3/toma` ou `ide/toma4`).

## 1. Parser do XML

No parser de CT-e, resolver o tomador:

- `toma3/toma` = 0 → Remetente (`rem`), 1 → Expedidor (`exped`), 2 → Recebedor (`receb`), 3 → Destinatário (`dest`)
- grupo `toma4` presente → usar `toma4/CNPJ` (ou `CPF`) e `toma4/xNome`, papel = Outros

O parser passa a devolver `tomador_cnpj`, `tomador_nome` e `tomador_papel` (REMETENTE, EXPEDIDOR, RECEBEDOR, DESTINATARIO, OUTROS), além de também extrair expedidor e recebedor do XML.

## 2. Banco de dados

Na tabela `ctes` (banco central):

- `tomador_cnpj` (texto, opcional)
- `tomador_nome` (texto, opcional)
- `tomador_papel` (enum: REMETENTE, EXPEDIDOR, RECEBEDOR, DESTINATARIO, OUTROS)

## 3. Ingestão

- A empresa (`empresa_id`) passa a ser buscada em `empresas.cnpj` pelo `tomador_cnpj`.
- Sem correspondência de tomador (ou de transportadora) → CT-e fica em `PENDENTE_IDENTIFICACAO`, como já ocorre hoje.
- Log de ingestão passa a registrar a mensagem "Tomador não cadastrado" quando for o caso.
- Quando a empresa é encontrada apenas com CNPJ, a razão social é completada com o nome do tomador (comportamento atual mantido).

## 4. Reprocessamento retroativo

Nova ação que relê o XML já armazenado (`xml_conteudo`, com fallback no arquivo) e recalcula tomador + `empresa_id` + status, sem novo upload:

- Botão "Reprocessar identificação" na tela de detalhe do CT-e (reprocessa aquele CT-e).
- Botão "Reprocessar identificação" na listagem, em lote sobre os CT-e filtrados, com barra de progresso e resumo ao final (quantos identificados / pendentes).

## 5. Listagem de CT-e

Nova coluna "Tomador" (gerenciável pelo seletor de colunas existente): nome do tomador com o papel entre parênteses — ex.: `UBAIA COSMETICOS LTDA (Remetente)`. Sem identificação, badge de alerta "Tomador não identificado", no mesmo padrão visual de "Transportadora: não identificada".

## 6. Detalhe do CT-e

Novo card "Tomador do Serviço (Responsável Financeiro)", separado do bloco do destinatário, com:

- CNPJ e nome do tomador
- Papel (Remetente / Expedidor / Recebedor / Destinatário / Outros)
- Empresa interna correspondente (`empresas.razao_social`) quando identificada
- Quando não identificada: aviso + ação "Vincular manualmente a uma empresa" (seleção entre as empresas cadastradas, ou cadastro rápido com os dados do tomador), que grava `empresa_id`, reavalia o status e dispara a auditoria

Uma nota curta no card deixa explícito que o tomador é quem paga o frete, podendo ou não coincidir com o destinatário da mercadoria.

## Detalhes técnicos

- `src/lib/cte-parse.server.ts`: seções `toma3`/`toma4`, `exped`, `receb`; novos campos em `ParsedCte`.
- Migração no banco central: enum `cte_tomador_papel` + 3 colunas em `speedflow.ctes`.
- `src/lib/cte-ingest.server.ts`: resolução de empresa por `tomador_cnpj`; gravação dos novos campos.
- `src/lib/cte-backfill.functions.ts`: nova server fn `reprocessarIdentificacaoCte` (por id) e uma variante em lote por lista de ids.
- `src/routes/_authenticated/ctes.index.tsx`: coluna Tomador + botão de reprocessamento em lote.
- `src/components/ctes/CteDetailView.tsx`: card do tomador, botão de reprocessar e diálogo de vínculo manual de empresa.
- Layout responsivo em grade, como os demais cards do detalhe.
