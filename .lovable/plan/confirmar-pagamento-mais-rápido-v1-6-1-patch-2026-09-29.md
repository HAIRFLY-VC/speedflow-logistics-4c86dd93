# Confirmar pagamento mais rápido (v1.6.1, PATCH)

## Onde o tempo é gasto hoje (lido no código)
Ao clicar em "Confirmar e enviar", o app faz tudo em sequência, e o usuário espera até o fim:
1. Refaz a conferência completa da rota no ERP (consultas + regravação de notas, pedidos e vínculos), mesmo que o lápis tenha acabado de fazer isso.
2. Remonta todo o detalhamento (consulta notas no ERP e PIX de novo).
3. Grava os valores no ERP **um pedido por vez** (rota com 25 pedidos = 25 envios em fila).
4. Cria a tarefa no Bitrix e só então responde.
5. Depois recarrega a lista inteira de rotas, que dispara nova conferência de todas as rotas visíveis.

Os tempos de cada etapa ainda não foram medidos; o primeiro passo é medir para confirmar qual pesa mais.

## O que muda
1. **Medir**: registrar a duração de cada etapa da confirmação (visível só nos registros do servidor).
2. **Conferência reaproveitada**: se a rota foi conferida há menos de 2 minutos (ao abrir o lápis), usar esse resultado em vez de refazer. Mais antigo que isso, confere de novo como hoje.
3. **Gravação no ERP em paralelo**: enviar os pedidos em lotes de 5 ao mesmo tempo, em vez de um por vez. Falhas continuam indo para a fila de reprocessamento.
4. **Bitrix em segundo plano**: a confirmação responde assim que os valores são gravados; a tarefa do Bitrix é criada logo em seguida sem prender a tela. Se falhar, vai para a fila de pendências como já acontece.
5. **Recarregar só a rota confirmada** na lista, em vez de todas as rotas.
6. Tela mostra etapas ("Gravando no ERP… Criando tarefa…") para o usuário saber que está andando.

As regras de bloqueio (valor, borderôs, notas, PIX, vínculo Bitrix, responsável) continuam iguais e continuam checadas no servidor.

## Riscos
- Bitrix em segundo plano: a tela pode mostrar "Pgto confirmado" alguns segundos antes da tarefa existir. Falhas aparecem na fila de pendências.
- Envio em paralelo aumenta a carga momentânea na API do ERP (limitado a 5 simultâneos).
- Sem mudança no banco.

## Checklist para publicar
- No preview: confirmar o pagamento de uma rota real e conferir valores no ERP e tarefa no Bitrix.
- Reverter: versão anterior no histórico.

## Detalhes técnicos
- `src/lib/rota-pagamento.server.ts` `confirmarPagamentoRota`: `console.time` por etapa; cache de auditoria (tabela local já gravada pela auditoria ou memória por `routeId` + timestamp; confirmar o armazenamento na implementação); `gravarLinhaValores` com pool de 5 (`Promise.allSettled`); `processarTarefaFinanceiraRota` disparado sem `await` (com `waitUntil` se disponível no Worker, senão fica para a rotina de retry).
- `PagamentoRotaDialog.tsx`: invalidar só as queries da rota; indicador de etapas.
- `version.ts` e `CHANGELOG.md`.
