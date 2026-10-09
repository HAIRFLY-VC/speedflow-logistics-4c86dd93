# Incluir notas já entregues no Custo de Frete (MINOR v1.34.0)

## Causa (confirmada)
- O pedido 4136262 existe no app (status ERP "11-EXPEDIDO"), mas sua nota não está na base usada pelo detalhamento.
- Essa base é o espelho de **entregas em aberto**: o Sync ERP só traz notas com status "A" (expedidas e não entregues) e apaga as que foram entregues. Na sua planilha o 4136262 está com STATUS "E" (entregue), por isso sumiu.
- Consequência: o card "Mercadorias faturadas", o % de frete e o detalhamento hoje subestimam o ciclo — só contam o que ainda não foi entregue.

## Correção
- Criar um espelho próprio de **notas faturadas** no banco central, alimentado pelo Sync ERP com todas as notas de A_GERENTREGAS faturadas nos ciclos comerciais recentes (ciclo atual e os 6 anteriores, para o gráfico de evolução), em qualquer status (A, E etc.), com todas as colunas da planilha.
- A tela "Entregas em aberto" continua usando o espelho atual, sem mudança.
- Painel Custo de Frete (cards, evolução, dimensões), card "% Frete do ciclo" em Rotas Pendentes e o detalhamento passam a ler o novo espelho.
- Os valores do ciclo vão aumentar (passam a incluir as notas entregues) — esperado.

## Riscos
- Banco compartilhado: só uma tabela nova; nada existente é alterado. A versão publicada continua lendo o espelho antigo até o Publish.
- ERP: somente leitura; uma consulta a mais no Sync (limitada por data de faturamento).
- Enquanto o script não rodar, o painel continua usando o espelho antigo (fallback automático).

## Detalhes técnicos
- `db/central/2026-10-09_notas_faturadas.sql`: `speedflow.notas_faturadas` (mesmas colunas de `entregas_abertas` + extras v1.33.0), PK (nro_nf, cod_pedido), índice em dt_fatur, GRANT select a authenticated / all a service_role. Reversão: `DROP TABLE`.
- `erp-sync.server.ts`: nova `sincronizarNotasFaturadas()` — `SELECT ... FROM GKS.A_GERENTREGAS G WHERE G.DT_FATUR >= :inicio AND G.NRO_NF IS NOT NULL` (inicio = `de` do 7º ciclo mais recente), dedup por NF+pedido (borderô mais recente, ocorrências unidas), upsert em lotes de 200, remove do intervalo as linhas não vistas.
- `custo-frete.query.ts`: `carregarCustoFrete` e `carregarMercadorias` leem `notas_faturadas`; se a tabela não existir, recaem em `entregas_abertas`.
- Tipos em `central/types.ts`; `version.ts` 1.34.0 e CHANGELOG.

## Checklist para publicar
- Rodar o SQL no banco central, depois Sync ERP.
- Conferir pedido 4136262 no detalhamento e comparar o total do ciclo out/26 com a planilha.
- Reverter: v1.33.1 no histórico + DROP da tabela nova.
