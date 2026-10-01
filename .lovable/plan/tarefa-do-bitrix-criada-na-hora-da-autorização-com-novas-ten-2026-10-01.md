## Tarefa do Bitrix criada na hora da autorização, com novas tentativas a cada minuto (PATCH 1.15.1)

### O que aconteceu na rota 442
- Autorizada às 09:45. A tarefa ficou na fila como "Pendente", com **0 tentativas**, e a próxima tentativa só foi marcada para 10:15, ou seja, 30 minutos depois.
- Desde 30/09 isso acontece com todas as rotas: as tarefas só são criadas 30 a 35 minutos depois de autorizar. Até 29/09, eram criadas em 1 a 2 segundos.

### Causas confirmadas
1. **A primeira tentativa não chega a acontecer.** Uma otimização recente passou a criar a tarefa "em segundo plano", depois que a tela já recebeu a resposta. No servidor, tudo o que roda depois da resposta é interrompido. Por isso a tarefa nunca é tentada na hora e fica só na fila.
2. **A fila espera 30 minutos para a primeira nova tentativa.** Esse prazo vem do padrão da fila. A versão publicada ainda não tem a correção de 1 minuto da v1.15.0. A rota 442 foi autorizada na versão publicada.
3. **O robô de novas tentativas roda só a cada 5 minutos.** O ajuste para rodar a cada minuto foi preparado, mas ainda não foi aplicado.

### O que vai mudar
- Ao clicar em "Confirmar e enviar", o app tenta criar a tarefa do Bitrix na hora, aguardando no máximo uns 10 segundos, e mostra o resultado:
  - Deu certo: "Tarefa do Bitrix criada (nº X)".
  - Falhou: "Pagamento confirmado; tarefa do Bitrix na fila, nova tentativa em 1 minuto", com o motivo.
- Se falhar, a tarefa fica marcada com erro e a próxima tentativa já fica agendada para 1 minuto depois, até 10 tentativas. O ícone âmbar de pendência continua aparecendo na rota.
- Vale também para "Lançar adicional" e para o lançamento de CT-e, que usam a mesma fila.
- O robô passa a rodar a cada minuto. São 1.440 execuções por dia. Cada uma é rápida e só age quando há algo vencido na fila, mas isso aumenta um pouco o custo do servidor. É o que garante o intervalo de 1 minuto que você pediu.
- A rota 442 será reprocessada logo após a correção.

### Riscos
- A confirmação pode levar alguns segundos a mais, por causa da espera pelo Bitrix, que tem limite de tempo.
- Banco: nenhuma estrutura nova. Só o horário do robô muda, de 5 em 5 minutos para cada minuto.
- **Importante:** só resolve na versão oficial depois que você publicar.

### Detalhes técnicos
- `rota-pagamento.server.ts`: trocar o `void processarTarefaFinanceiraRota(...)` por `await` com `Promise.race` de cerca de 10 segundos e devolver `bitrix: { ok, referencia?, erro? }` na resposta. A falha de vínculo com o Bitrix passa a gravar ERRO na linha da fila, em vez de só lançar a exceção. O mesmo vale para o fluxo de CT-e direto.
- Registrar a tentativa em `fila_tentativas` também na tentativa feita na hora.
- `PagamentoRotaDialog.tsx`: mostrar o aviso com o resultado do Bitrix.
- Cron `fila-pendencias-retry`: aplicar o SQL já preparado (`* * * * *`). Para reverter, voltar a `*/5 * * * *`.
- Reenviar o item da fila da rota 442 (`16fd684c…`) ajustando `proxima_tentativa_em = now()`.
- Atualizar `version.ts` para 1.15.1 e registrar no CHANGELOG.

### Checklist para publicar
- No teste, autorizar uma rota e conferir a mensagem "Tarefa do Bitrix criada".
- Conferir que o robô já está rodando a cada minuto. Ele fica no banco compartilhado, então vale para teste e oficial.
- Publicar. Para reverter: restaurar a versão anterior no histórico e voltar o robô para 5 em 5 minutos.
