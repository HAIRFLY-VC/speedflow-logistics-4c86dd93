# Corrigir visões de filtro: colunas e atualização de visões salvas

## O que está acontecendo

A visão salva chamada "Padrão" foi criada antes de o painel passar a guardar as colunas. Ao consultar o que está gravado nela, existem apenas os filtros: não há nenhuma informação de quais colunas exibir nem da ordem delas. Por isso, ao selecionar "Padrão", os filtros são aplicados mas as colunas continuam exatamente como estavam — não há o que aplicar.

## O que vai mudar

1. Atualizar uma visão já salva
   - No menu "Visões de filtro", cada visão sua ganha a ação "Atualizar com a seleção atual": grava nela os filtros, a ordenação, as colunas visíveis e a ordem das colunas que estão na tela naquele momento, mantendo o nome e o compartilhamento.
   - Também será possível renomear a visão.
   - Assim, basta abrir "Padrão", arrumar as colunas como quiser e clicar em "Atualizar" — daí em diante selecionar "Padrão" reposiciona as colunas.

2. Visões antigas (sem colunas gravadas)
   - Ao selecionar uma visão que não guardou colunas, o app avisa em texto curto que aquela visão só define filtros, sugerindo atualizá-la.

3. Ao salvar com um nome que já existe, a visão passa a ser substituída por completo (filtros + colunas), como já é indicado na tela.

## Detalhes técnicos

- `src/lib/filter-views.functions.ts`: `saveFilterView` já aceita `id`; expor também `name` opcional no update para renomear e garantir que o `definition` é sobrescrito por inteiro.
- `src/components/data-table/FilterViewsBar.tsx`:
  - novo botão por item ("Atualizar" / ícone de refresh) chamando `saveFilterView` com `{ id, name, definition: definicaoAtual }` e invalidando `["filter-views", tableKey]`;
  - diálogo de renomear reaproveitando o diálogo de salvar;
  - ao aplicar, se `definition.columnOrder`/`visibleColumns` estiverem ausentes, exibir toast informativo.
- `src/routes/_authenticated/entregas-abertas.tsx`: nenhuma mudança de lógica; já envia `visibleColumns` e `columnOrder` em `definicaoAtual` e já os aplica em `aplicarConjunto`.

## Verificação

- Typecheck e build.
- No navegador: reordenar colunas, atualizar a visão "Padrão", trocar a ordem manualmente, reaplicar "Padrão" e conferir que as colunas voltam à ordem gravada.
