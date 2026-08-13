# Corrigir "Importando..." infinito no botão de forçar importação de CT-e

## O que está acontecendo

O pedido de importação criado às 23:25 continua com status `PENDENTE` mais de 15 minutos depois — ou seja, o robô local nunca o pegou. O botão fica em "Importando..." para sempre porque a tela só sai desse estado quando o robô reporta conclusão, e não existe nenhum limite de tempo nem forma de cancelar.

Causa provável: o robô instalado no servidor ainda é a versão anterior, que não consulta a fila de comandos (`cte-comandos`). Enquanto ele não for atualizado, todo pedido fica preso em `PENDENTE`.

## Correções no aplicativo

1. **Expirar pedidos parados**: ao consultar o último comando, marcar automaticamente como `ERRO` (mensagem "Robô não respondeu — verifique se o serviço está atualizado e ativo") todo comando `PENDENTE` há mais de 3 minutos ou `PROCESSANDO` há mais de 10 minutos. Isso destrava a tela sozinho e libera novas solicitações.
2. **Botão de cancelar**: enquanto houver importação em andamento, exibir a opção de cancelar, que encerra o comando atual e devolve o botão ao estado normal.
3. **Feedback de espera**: mostrar há quanto tempo o pedido está aguardando o robô, em vez de apenas "Importando...".
4. **Parar de solicitar em duplicidade**: ao clicar novamente com um comando expirado, criar um novo em vez de reaproveitar o antigo.

## Atualização do robô (passo necessário no servidor)

O robô precisa ser atualizado para a versão que consulta a fila de comandos. Vou regenerar o pacote de download do robô; no servidor, substituir os arquivos e reiniciar o serviço `RoboCTeSpeedFlow`. Sem isso, a importação forçada continuará sem resposta (a tela apenas passará a avisar em vez de girar indefinidamente).

## Detalhes técnicos

- `src/lib/cte-captura.functions.ts`: em `getUltimoComandoCaptura`, expirar comandos antigos (update para `ERRO` + `concluido_em`); nova server fn `cancelarCapturaCte`.
- `src/routes/_authenticated/ctes.tsx`: estado de espera com tempo decorrido, botão cancelar, invalidação da lista ao finalizar.
- `robo-cte/`: regerar o ZIP com o `index.js` atual (polling de `cte-comandos`).
