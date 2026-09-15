# Separacao: ajustar cards do painel

## Mudancas pedidas

1. Remover o card **Em separacao agora** do painel.
2. O card **Caixas por hora** passa a ser calculado entre a inclusao do pedido
   (`dt_inc`) e o fim da separacao (`dt_fim_sep`): para cada pedido concluido
   no periodo, soma-se o tempo de `dt_inc` ate `dt_fim_sep` e divide-se o
   total de caixas por esse tempo acumulado.

## Como fica

- O bloco de cards perde "Em separacao agora"; o card "Na fila" permanece.
- Caixas por hora = total de caixas do periodo ÷ soma das horas
  `dt_inc -> dt_fim_sep` dos pedidos concluidos no periodo. Pedidos sem
  `dt_inc` ou sem `dt_fim_sep` nao entram na soma de horas.
- Se nao houver horas apuraveis, o card mostra "—".
- A mesma base (`dt_inc -> dt_fim_sep`) passa a valer na coluna de caixas/hora
  da tabela por separador, para manter coerencia.

## Detalhes tecnicos

- Arquivo: `src/routes/_authenticated/separacao.tsx`.
- Remover o card/constante `andamento` usada apenas nele (manter `fila`).
- Trocar `horasTrabalhadas` para somar `horas(r.dt_inc, r.dt_fim_sep)`.
- No agregado por separador, trocar `horas(r.dt_ini_sep, r.dt_fim_sep)` por
  `horas(r.dt_inc, r.dt_fim_sep)` no calculo de `cxHora`.
- O KPI "Em separacao agora" e o detalhe de separadores ativos somem com o
  card; nenhuma mudanca na consulta ao ERP.
