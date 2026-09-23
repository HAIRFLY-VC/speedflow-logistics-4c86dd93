# Sync ERP travado em "processando"

## O que aconteceu
- Às 13:11 a sincronização começou e ficou registrada como "em andamento".
- A conexão com o servidor caiu no meio (registro "aborted"), e o processo foi encerrado antes de terminar.
- Por isso a execução nunca foi marcada como concluída ou com falha: continua "running", com 0 pedidos.
- O botão fica consultando essa execução esperando ela terminar, e ela nunca termina.

## Correções
1. **Limpar execuções abandonadas**: qualquer execução "em andamento" há mais de 10 minutos passa a ser marcada como "falhou (interrompida)". Isso roda no início de cada nova sincronização e também quando o botão consulta o andamento.
2. **Botão não fica preso**: se a execução acompanhada estiver parada há mais de 10 minutos, o botão para de girar e mostra "A sincronização anterior foi interrompida. Clique para tentar de novo."
3. **Limite de tempo nas consultas ao ERP**: cada chamada ao ERP ganha um tempo máximo; se estourar, a execução é gravada como falha com a mensagem do motivo, em vez de ficar pendurada.
4. **Evitar duas ao mesmo tempo**: se já houver uma execução ativa recente (menos de 10 min), o botão avisa "Sincronização já em andamento" em vez de iniciar outra.
5. **Destravar agora**: marcar como falha a execução das 13:11 que ficou presa, e rodar uma nova sincronização para confirmar.

## Detalhes técnicos
- `src/lib/erp-sync.server.ts`: no início de `syncErpOrders`, `update erp_sync_runs set status='failed', finished_at=now(), errors=[{message:'Interrompida'}] where status='running' and started_at < now()-10min`; checar execução ativa recente antes de inserir; `AbortSignal.timeout` nos fetch ao ERP; `try/finally` garantindo `finished_at`.
- `src/components/layout/ErpSyncButton.tsx`: em `waitForRun`, se `status='running'` e `started_at` > 10 min, encerrar com erro amigável; invalidar `["erp","last-sync"]`.
