# Filtro por status do pagamento na tela Autorizar pagamento de frete

## O que será feito

Na tela **Autorizar pagamento de frete**, o cabeçalho da coluna **Frete (R$)** passa a ter o ícone de filtro (mesmo comportamento das demais colunas da tabela), com duas opções:

- **Confirmado** — rotas com pagamento confirmado (selo verde "Pgto confirmado").
- **Pendente** — rotas ainda sem pagamento confirmado.

Nenhuma coluna nova é adicionada; o layout atual (colunas ajustadas para caber na tela) permanece igual. O filtro pode ser combinado com os demais filtros de coluna e é salvo nas visões de filtro salvas.

## Como será feito

1. `src/components/data-table/types.ts` — acrescentar em `ColumnDef` o campo opcional `filterAccessor?: (row) => unknown`, que define o valor usado apenas pelo filtro de coluna, sem afetar ordenação ou células.
2. `src/components/data-table/DataTable.tsx` — nas duas rotinas que hoje usam `col.accessor(r)` para o filtro (catálogo de valores distintos e o `filter` das linhas), usar `col.filterAccessor(r)` quando existir.
3. `src/components/routes/RotasView.tsx` — na coluna `total_freight` ("Frete (R$)"), habilitar o filtro (`filterable` deixa de ser `false`) e definir `filterAccessor` retornando `"Confirmado"` quando a rota tem `frete_confirmado_em`, e `"Pendente"` caso contrário.

A coluna de frete é compartilhada entre as telas; como o filtro deriva dos dados exibidos, também fica disponível em Rotas Pendentes, sem alteração de comportamento ou aparência.

## O que não muda

- Nada no banco de dados, no fluxo de confirmação de pagamento ou nas permissões.
- O botão "Confirmar Pgto / Reabrir / Lançar adicional" e as regras atuais continuam iguais.

## Verificação

- Typecheck (`bunx tsgo --noEmit`) e build sem erros.
- Playwright: abrir `/autorizar-pagamento-frete`, filtrar por "Confirmado" e conferir que só aparecem rotas com o selo "Pgto confirmado"; filtrar por "Pendente" e conferir o inverso; limpar o filtro.
