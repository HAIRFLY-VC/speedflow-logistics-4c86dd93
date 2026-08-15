# Corrigir travamento do botão "Forçar importação"

## O que os dados mostram (verificado agora)

- As rotas do robô estão no ar na produção: `cte-comandos` e `nfe-pendentes` respondem 401 (sem segredo) e `ingest-cte` responde 200. Ou seja, o aplicativo publicado está correto.
- O robô **funcionou** hoje: o pedido das 11:02 (horário local) foi assumido e concluído em 3 segundos ("0 CT-e enviados").
- O último contato do robô com o aplicativo foi **13:14:49** (nas duas rotas, com 1 segundo de diferença). Desde então, nada — mais de 4 horas em silêncio.
- O pedido das 17:27 ficou 5 minutos como PENDENTE, nunca foi assumido (`iniciado_em` vazio) e expirou com a mensagem do print.

Conclusão: o problema **não está no aplicativo** — o robô no servidor parou de consultar a fila às 13:14. Ou o serviço caiu/foi parado, ou ele ficou preso em uma chamada à SEFAZ que nunca retorna (o ciclo regular a cada 30 min não tem limite de tempo global, então uma consulta travada congela também a verificação de comandos).

## Correções

1. **Destravar agora (no servidor)**: reiniciar o serviço `RoboCTeSpeedFlow` e conferir no log local a última linha registrada às ~13:14 — ela indica em que etapa ele parou. Assim que o serviço voltar, o botão volta a funcionar no próximo ciclo (60s).
2. **Watchdog no robô**: aplicar um limite de tempo global ao ciclo de empresas e às consultas à SEFAZ. Se o ciclo ultrapassar o limite (ex.: 15 min), ele é abortado, registrado no log e o robô volta a atender a fila de comandos em vez de ficar preso.
3. **Heartbeat independente do ciclo**: enviar o sinal de "estou vivo" em um temporizador próprio (a cada 60s), inclusive durante uma leitura longa na SEFAZ. Hoje o heartbeat só é gravado quando o robô consulta as rotas, por isso "robô ocupado" e "robô caído" ficam indistinguíveis.
4. **Aviso no aplicativo antes de solicitar**: quando o último contato do robô for maior que 5 minutos, mostrar o estado "Robô offline (sem contato há X)" ao lado do botão e pedir confirmação antes de criar o pedido, em vez de deixar o usuário esperar 5 minutos até a mensagem de falha.
5. **Mensagem de expiração mais precisa**: diferenciar "robô sem contato desde <hora> — serviço provavelmente parado" de "robô ativo, porém ocupado" usando o heartbeat do item 3.

## Detalhes técnicos

- `robo-cte/index.js`: `withTimeout()` envolvendo `executarCicloEmpresas` e cada consulta SOAP; `setInterval` dedicado chamando um novo hook de heartbeat; log da causa do aborto.
- Nova rota `src/routes/api/public/hooks/robo-heartbeat.ts` (mesma autenticação por `CTE_INGEST_SECRET`) gravando via `registrarContatoRobo("robo")`, com campo de estado (`ocioso` / `lendo-sefaz`).
- `src/lib/cte-captura.functions.ts`: `getStatusRobo` passa a retornar também o estado; mensagem de expiração ajustada conforme o item 5.
- `src/routes/_authenticated/ctes.index.tsx`: indicador de robô online/offline/ocupado e confirmação antes de solicitar quando offline.
- É necessário reinstalar o pacote do robô no servidor depois das mudanças (itens 2 e 3).
