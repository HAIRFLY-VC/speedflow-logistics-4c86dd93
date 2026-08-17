# Aprovação de CT-e e lançamento no ERP

O schema base já está aplicado no banco central (`ordens_pagamento_frete` com status de aprovação, `mapeamento_componentes_erp`, `fila_lancamento_erp_frete`, `integracao_n8n` e o gatilho que chama o n8n). Falta o restante: segunda fila para o financeiro, telas de aprovação/reprovação, de-para de componentes, rateio por NF-e e o retorno do n8n.

## 1. Complemento de schema (banco central)

- Nova fila `fila_provisionamento_financeiro`: ordem de pagamento, payload (transportadora, CNPJ, valor total, chave do CT-e, borderô, vencimento sugerido), status, tentativas, erro, referência do ERP.
- Gatilho próprio que dispara o n8n nessa fila (mesma configuração `integracao_n8n`, com um campo de URL separado para o fluxo financeiro).
- Em `fila_lancamento_erp_frete`, permitir mais de uma linha por ordem (uma por NF-e rateada) em vez de uma só.

## 2. Aprovação / reprovação do CT-e

No detalhamento do CT-e (para ADM ou quem tem permissão de autorizar frete):

- Botões **Aprovar** e **Reprovar**. Reprovar exige observação obrigatória.
- Ao aprovar, o app monta a distribuição dos valores usando o de-para de componentes, mostra uma prévia (frete, perna, diária, pernoite, reentrega, descarrego) e o rateio por NF-e.
- Busca no ERP os registros de `a_gerentregas` por `cod_filial` + `nro_nf` de cada NF-e do CT-e. Se houver mais de um registro para a mesma NF, abre modal para o usuário escolher qual registro receberá o lançamento; a escolha é gravada na ordem.
- Só após a confirmação as duas filas são gravadas (lançamento nos valores + provisionamento financeiro), em uma única operação no servidor.
- Bloqueios: CT-e já aprovado não é reenviado; componente do CT-e sem de-para bloqueia a aprovação com aviso indicando o componente.

## 3. De-para de componentes (Config. de fretes)

Nova seção para mapear nome do componente do CT-e → campo do ERP (`vlr_frete`, `vlr_perna`, `vlr_diaria`, `vlr_pernoite`, `vlr_reentrega`, `vlr_descarrego`), com regra padrão geral e exceções por transportadora. Lista os componentes ainda não mapeados encontrados nos CT-es importados, para facilitar o cadastro.

## 4. Rateio entre NF-es

Os valores do CT-e são distribuídos entre as NF-es do documento proporcionalmente ao peso bruto; sem peso, proporcional ao valor da mercadoria; sem os dois, divisão igual. O ajuste de centavos vai para a primeira NF-e para o total bater exatamente com o CT-e.

## 5. Retorno do n8n

Rota pública `/api/public/hooks/erp-fila-callback`, protegida por secret compartilhado (`ERP_FILA_CALLBACK_SECRET`), que recebe `fila_id`, sucesso/erro e a referência gerada no ERP, atualizando a fila e a ordem de pagamento. Serve para as duas filas.

## 6. Tela "Pagamento de fretes"

- Colunas de status de aprovação (Pendente/Aprovado/Reprovado), status da fila de valores e status da fila financeira, com o erro quando houver.
- Filtro por status e ação de **reenviar** um item com erro (recoloca em PENDENTE e redispara o webhook).
- Configuração da URL/token do n8n em Configurações (gravado no banco, não no código).

## Notas técnicas

- SQL aplicado no banco central via `EXTERNAL_DB_URL`/REST de serviço, no esquema `speedflow`; as novas tabelas não recebem grant para `anon`/`authenticated`.
- Toda a lógica (cálculo, de-para, rateio, consulta ao Oracle) roda em server functions com verificação de `pode_autorizar_frete`; o frontend nunca fala com o Oracle.
- A consulta de `a_gerentregas` reaproveita `src/lib/frete-nfe-erp.server.ts` (API Oracle `/v1/query`).
- A gravação no Oracle é feita pelo n8n, não pelo app: o app só publica a fila e recebe o callback.
