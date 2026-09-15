# Ajuste nos cards do painel de Separação

## Objetivo
Simplificar o topo do painel `/separacao` alterando três indicadores de tempo.

## Mudanças

1. **Remover o card "Tempo médio de espera".**
2. **Remover o card "Tempo médio de conferência".**
3. **Manter o card "Tempo médio de separação"**, mas recalcular o valor como o tempo entre `dt_inc` (inclusão/liberação do pedido) e `dt_fim_sep` (fim da separação), usando o helper `horas(dt_inc, dt_fim_sep)` já existente.

## Arquivo afetado
- `src/routes/_authenticated/separacao.tsx`

## Detalhes técnicos
- Remover o ícone `Timer` do import do `lucide-react` se não for mais usado.
- Remover as constantes `tEspera` e `tConf`.
- Alterar `tSep` de `horas(r.dt_ini_sep, r.dt_fim_sep)` para `horas(r.dt_inc, r.dt_fim_sep)`.
- Remover os três componentes `<Indicador />` correspondentes.
- Ajustar o grid de cards para 4 cards restantes (manter `xl:grid-cols-4` ou adaptar para `xl:grid-cols-3`).
- A tabela de produtividade por separador permanece inalterada, pois o pedido se refere apenas aos cards.

## Validação
- `bunx tsgo --noEmit` sem erros.
- Acessar `/separacao` e confirmar que apenas os cards "Na fila", "Concluídos no período", "Caixas por hora" e "Fila acima de 24h" aparecem.
- Confirmar que o card "Tempo médio de separação" exibe valor calculado entre inclusão e fim da separação.
