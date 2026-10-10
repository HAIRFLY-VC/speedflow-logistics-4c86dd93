# Multi-seleção no combo de período comercial (MINOR v1.39.0)

## O que muda
O seletor de ciclo comercial deixa de ser de seleção única e passa a permitir marcar vários ciclos; os totais, cards e tabelas passam a somar os ciclos marcados.

- Novo componente de multi-seleção (popover com lista de ciclos e caixas de marcação, mesmo estilo dos filtros de coluna): busca não é necessária, a lista mostra os 12 ciclos disponíveis.
- Comportamento: nenhum ciclo marcado → ciclo atual (como hoje); um ciclo → igual ao comportamento atual; vários ciclos → dados somados.
- Resumo (trigger) mostra "Ciclo atual" quando nada marcado, o rótulo do ciclo quando só um está marcado e "N ciclos" quando há vários.
- Botão "Limpar" dentro do popover volta ao ciclo atual.

## Telas afetadas
- **Custo de Frete** (`/custo-frete`): cards de indicadores, evolução permanece (últimos 6 ciclos, inalterada) e as 6 tabelas por dimensão somam os ciclos marcados. O card "Mercadorias faturadas" leva à tela de detalhe com os ciclos marcados.
- **Mercadorias faturadas** (`/custo-frete-mercadorias`): mesmo seletor multi; a URL continua usando `?ciclo=`, agora aceitando vários separados por vírgula (ex.: `?ciclo=2026-10,2026-09`), mantendo compatibilidade com links antigos de um ciclo só. Cards, totais, filtros de coluna e exportação Excel refletem a soma.
- O card "% Frete do ciclo" da tela Rotas Pendentes continua mostrando apenas o ciclo atual (sem alteração).

## Regras de consolidação
- Pedidos reentregues passam a ser consolidados sobre o conjunto de ciclos marcados (uma linha por pedido, maior borderô, frete somado) — mesma regra já usada dentro de um ciclo.
- Pedidos aparecem uma única vez mesmo se notas do mesmo pedido caírem em ciclos diferentes.

## Riscos
Nenhum impacto no banco ou integrações; apenas tela. Sem feature flag (política: oficial = teste ao publicar). Consultas passam a somar 1 página por ciclo marcado (paginação de 1.000 já existente).

## Detalhes técnicos
- Novo `src/components/custo-frete/CicloMultiSelect.tsx`: `Popover` + itens com checkbox; props `ciclos`, `selecionados`, `onChange`.
- `src/lib/custo-frete.query.ts`: nova `custoFreteMultiQueryOptions(ciclos: CicloComercial[])` que carrega cada ciclo com `carregarCustoFrete` e concatena; a existente de um ciclo permanece para o card `% Frete`.
- `src/routes/_authenticated/custo-frete.tsx`: estado `sel: string[]` no lugar de `sel: string | null`; usa a query multi; link do card passa os ciclos marcados.
- `src/routes/_authenticated/custo-frete-mercadorias.tsx`: `validateSearch` continua com `ciclo` string; parse em lista; queryFn itera os ciclos (base → provisões → concatena → `consolidarReentregas` uma única vez).
- Versão 1.39.0 + CHANGELOG.

## Checklist para publicar
- Testar no preview: marcar 2 ciclos em Custo de Frete e conferir % Frete somado; abrir Mercadorias faturadas pela URL com 2 ciclos; conferir cards, totais, filtros e Excel.
- Migrações: nenhuma. Flags: nenhuma.
- Reverter: voltar à v1.38.1 no histórico.
