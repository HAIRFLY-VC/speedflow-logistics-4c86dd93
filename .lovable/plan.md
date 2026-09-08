# Filtros por coluna (estilo Excel) no painel Entregas em aberto

## O que muda para o usuário

- Cada coluna do grid ganha um ícone de filtro no cabeçalho. Ao clicar, abre um painel igual ao do Excel, com opções conforme o tipo do dado:
  - **Texto** (Cliente, Cidade, UF, RCA, Transportadora, Modal, Faixa, NF, Pedido, Ação, Responsável): busca dentro da lista, "Selecionar tudo", lista rolável de valores únicos com contagem, e condições "contém / não contém / começa com / igual a".
  - **Número** (Dias, Valor, Peso): condições "igual, diferente, maior que, maior ou igual, menor que, menor ou igual, entre" com campos de valor.
  - **Data** (Dt. pedido, Dt. faturamento, Dt. saída, Prazo): condições "igual, antes de, depois de, entre" com seletor de data, mais opção "vazio".
- Vários filtros podem ficar ativos ao mesmo tempo (combinação E entre colunas). As opções de cada coluna refletem os demais filtros já aplicados.
- Colunas filtradas mostram o ícone destacado; há um botão "Limpar filtros" e um resumo dos filtros ativos.
- O card de entregas pendentes e os totais do rodapé continuam refletindo exatamente o que está filtrado.
- Ordenação por clique no cabeçalho (crescente/decrescente), também salva.

## Persistência no perfil

A última configuração de filtros (e a ordenação) é salva automaticamente no perfil do usuário logado. Ao voltar ao painel, o grid já abre com os mesmos filtros aplicados. Um botão "Restaurar padrão" apaga o que foi salvo.

## Detalhes técnicos

- Reutilizar a infraestrutura existente: tabela `user_table_preferences` e as funções `getTablePrefs` / `saveTablePrefs` / `resetTablePrefs` em `src/lib/table-prefs.functions.ts`, com `tableKey: "entregas-abertas"`. Não é preciso migração de banco.
- Estender o tipo `TablePreferences` com um campo opcional `columnFilters`, mantendo `filters` (compatibilidade com telas atuais):

```text
columnFilters: {
  [columnId]: 
    | { type: "text",   values?: string[], op?: "contains"|"notContains"|"startsWith"|"equals", value?: string }
    | { type: "number", op: "eq"|"neq"|"gt"|"gte"|"lt"|"lte"|"between", value?: number, value2?: number }
    | { type: "date",   op: "eq"|"before"|"after"|"between"|"empty", value?: string, value2?: string }
}
```
  `normaliseFilters`/`mergePrefs` em `src/components/data-table/useTablePrefs.ts` passam a ler e mesclar `columnFilters`; salvamento continua debounced (400 ms).
- Novo componente `src/components/data-table/ColumnFilter.tsx`: popover com as três variantes (texto/número/data), recebendo `type`, opções calculadas e valor atual.
- Em `src/routes/_authenticated/entregas-abertas.tsx`:
  - definir um descritor de colunas (`id`, rótulo, tipo, acessor de valor bruto e de exibição) usado tanto pelo cabeçalho quanto pela filtragem;
  - substituir os `MultiFiltro` avulsos e os sete `useState` de filtro por um estado único vindo de `useTablePrefs("entregas-abertas", ...)`, aplicado por um utilitário `aplicaFiltros(itens, columnFilters, excetoColuna)` — o parâmetro `exceto` mantém a lógica atual de opções cruzadas;
  - manter busca livre, card de pendentes, rodapé de totais e o sheet de ação/responsável/prazo sem alteração de comportamento;
  - enquanto as preferências carregam, mostrar o estado de carregamento já existente para evitar piscar a lista sem filtros.
- Sem mudanças no backend além do uso das funções já existentes.
