# Card "Em separação agora": separadores ativos por incidência no período

## O que mudar

Atualmente o detalhe "X separador(es) ativo(s)" no card **Em separação agora** conta os separadores dos pedidos que estão literalmente em andamento (`dt_ini_sep` preenchido e `dt_fim_sep` vazio). O solicitante quer que esse número reflita a **incidência de separadores que tiveram atividade no período selecionado**, ou seja, separadores que aparecem em pedidos com `dt_ini_sep` ou `dt_fim_sep` dentro do intervalo escolhido.

## Passos

1. **Adicionar helper de intervalo** em `src/routes/_authenticated/separacao.tsx` para testar se uma data ISO está entre `inicio` e `fim` do filtro (inclusive).
2. **Recalcular `separadoresAtivos`** contando separadores distintos de:
   - todos os registros de `periodo` (pois a consulta do ERP já garante `dt_fim_sep` no período);
   - registros de `abertos` onde `dt_ini_sep` estiver dentro do período (separações iniciadas no período e ainda não concluídas).
3. **Manter o valor principal do card** como a quantidade de pedidos em andamento (`andamento.length`); apenas o detalhe "separador(es) ativo(s)" passa a usar a nova regra.
4. **Respeitar o filtro de separador** já aplicado: como `periodo` e `abertos` são filtrados previamente, o contador refletirá naturalmente a seleção do usuário.
5. **Verificar** com `bunx tsgo --noEmit` e observar o card no preview para confirmar que o detalhe acompanha o período escolhido.
