# Corrigir os erros da sincronização com o ERP

Investiguei o histórico de sincronizações e o agendamento automático. São **dois problemas independentes**, os dois confirmados.

## O que está acontecendo

**1. A sincronização manual não termina (é interrompida pelo tempo limite do servidor).**
As quatro últimas execuções de hoje (21:51, 21:59, 22:00 e 22:29) ficaram travadas em "em andamento", sem hora de término e sem nenhum pedido processado registrado. A última execução que chegou ao fim foi às 20:34 e demorou **4 minutos e 12 segundos** para 140 pedidos (as anteriores, com 217 e 263 pedidos, levaram ~3 min). O servidor corta a requisição bem antes disso, então o processo morre no meio: parte dos pedidos até é gravada, mas a execução nunca é fechada e a tela mostra erro.

Motivo do tempo alto: para cada pedido a sincronização faz uma consulta e uma gravação separadas no banco (em blocos de 15), além de recriar as rotas pendentes uma a uma. São milhares de idas e voltas ao banco numa única requisição.

**2. A sincronização automática (a cada 15 minutos) está sendo recusada há tempos.**
O agendamento chama o endereço público de sincronização, mas envia apenas a chave pública do backend — **não envia o segredo esperado pelo endpoint**. Resultado: todas as chamadas voltam com "não autorizado" (401). Confirmei nos registros do servidor: 21:45, 22:00, 22:15 e 22:30 → 401. Ou seja, hoje só sincroniza quando alguém clica no botão.

## O que vou fazer

**Tornar a sincronização rápida o bastante para caber no limite do servidor**
- Trocar o par "consulta + gravação por pedido" por uma gravação em lote única por bloco (inserir-ou-atualizar pelo código do pedido do ERP), eliminando ~2 idas ao banco por pedido.
- Fazer a recriação das rotas pendentes e o vínculo pedido↔rota em lote, em vez de linha a linha.
- Marcar a execução como concluída (ou com erro) mesmo que algo falhe no meio, para nunca mais ficar "em andamento" para sempre.
- Fechar automaticamente as execuções antigas que ficaram penduradas, para o histórico voltar a refletir a realidade.

**Reativar a sincronização automática**
- Corrigir o agendamento para enviar o segredo correto no cabeçalho que o endpoint espera, e confirmar que as chamadas seguintes voltam com sucesso.

**Verificação**
- Rodar uma sincronização manual e conferir: execução com status "concluída", hora de término e contagem de pedidos.
- Conferir, nos registros, que a chamada automática seguinte volta com sucesso em vez de 401.

## Detalhes técnicos

- `src/lib/erp-sync.server.ts`: substituir `processRow` (select `orders` por `erp_id` + update/insert individual) por `upsert` em lote com `onConflict: "erp_id"` sobre blocos de ~200 linhas; agrupar as inserções de `route_orders` e a recriação de `routes` em chamadas únicas; envolver todo o corpo em `try/finally` que grava `finished_at`/`status` na `erp_sync_runs`.
- Requer índice único em `speedflow.orders(erp_id)` para o `onConflict` (migração em `db/central/`, índice único simples, sem cláusula parcial — já tivemos o erro `42P10` por índice parcial).
- Migração de manutenção: `update erp_sync_runs set status='failed', finished_at=now() where status='running' and started_at < now() - interval '15 minutes'`.
- Agendamento `cron.job` id 1: recriar o `net.http_post` incluindo `"x-cron-secret": <ERP_SYNC_CRON_SECRET>` nos headers (hoje envia só `apikey`), mantendo o intervalo de 15 minutos.
