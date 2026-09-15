# Corrigir o card "Caixas por hora"

## Problema

Hoje o card divide o total de caixas pela soma das durações de cada pedido
(início até fim da separação). No ERP a maioria dos pedidos tem início e fim
gravados praticamente no mesmo instante, então essa soma dá zero e o card fica
sem informação ("—"), mesmo havendo pedidos separados.

## Como passa a calcular

Produtividade por tempo real de trabalho da equipe, não por duração de pedido:

1. Para cada separador, considerar os pedidos concluídos no período.
2. Calcular a janela de trabalho desse separador: do primeiro horário
   (início ou, se ausente, fim de separação) até o último fim de separação.
3. Somar as janelas de todos os separadores = horas de equipe no período.
4. Caixas por hora = total de caixas ÷ horas de equipe.

Se um separador tiver apenas um pedido (janela zero), aplica-se um piso mínimo
por pedido para não dividir por zero.

Fallbacks:
- Sem horas de equipe apuráveis mas com caixas e pedidos no período, o card
  mostra a média de caixas por pedido como detalhe, deixando claro que é outra
  base de cálculo.
- Sem pedidos no período, continua exibindo "—".

O detalhe abaixo do número passa a indicar a base usada, por exemplo
"1.240 caixas em 6h30 de equipe".

A mesma regra de janela é aplicada à coluna de caixas/hora por separador, para
que a tabela fique coerente com o card.

## Detalhes técnicos

- Arquivo: `src/routes/_authenticated/separacao.tsx`.
- Substituir `horasTrabalhadas` (soma de `horas(dt_ini_sep, dt_fim_sep)`) por
  uma função que agrupa por separador e soma `max(dt_fim_sep) - min(dt_ini_sep
  ?? dt_fim_sep)`, com piso de 1 minuto por pedido.
- Reutilizar a mesma função no agregado por separador (campo `cxHora`).
- Nenhuma mudança na consulta ao ERP nem em `separacao.functions.ts`.
