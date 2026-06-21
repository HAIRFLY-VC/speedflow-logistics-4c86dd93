# Listas customizáveis com layout persistido por usuário

Objetivo: dar ao usuário controle total sobre as listas (Pedidos, Rotas, Clientes, Produtos, Fretistas, Usuários, Borderôs, Minhas Rotas) — mostrar/ocultar colunas, reordenar, definir ordenação padrão e filtrar por conteúdo de cada coluna. O layout escolhido é salvo no banco por usuário e por tela, e é restaurado automaticamente em qualquer dispositivo.

## O que o usuário verá

Em cada tela de lista:
- Um botão **"Colunas"** abre um painel onde ele:
  - marca/desmarca colunas para exibir
  - arrasta para reordenar
  - define qual coluna ordena por padrão (ASC/DESC)
  - pode **Restaurar padrão** a qualquer momento
- Um ícone de **filtro** no cabeçalho de cada coluna abre um campo de busca tipo "contém". Filtros ativos aparecem como chips acima da tabela.
- Clique no cabeçalho continua alternando a ordenação rapidamente.
- Tudo é salvo automaticamente ao mudar; ao reabrir o app (mesmo em outro navegador), o layout volta igualzinho.

## Telas contempladas
Pedidos, Rotas, Clientes, Produtos, Fretistas, Usuários, Borderôs, Minhas Rotas. Cada uma tem um `tableKey` único (`pedidos`, `rotas`, etc.).

## Detalhes técnicos

### Banco (Lovable Cloud)
Nova tabela `user_table_preferences`:
- `user_id` (uuid, FK auth.users)
- `table_key` (text) — ex.: "pedidos"
- `preferences` (jsonb) — `{ columns: [{id, visible, order}], sort: {id, dir}, filters: {colId: "texto"} }`
- `updated_at`
- PK composta `(user_id, table_key)`
- RLS: usuário só lê/escreve as próprias preferências
- GRANTs para `authenticated` e `service_role`

### Server functions (`src/lib/table-prefs.functions.ts`)
- `getTablePrefs({ tableKey })` — retorna preferências do usuário atual
- `saveTablePrefs({ tableKey, preferences })` — upsert
Ambas com `requireSupabaseAuth`.

### Componente `DataTable` reutilizável
`src/components/data-table/DataTable.tsx`:
- Props: `tableKey`, `columns` (definição: id, header, accessor, sortable, filterable, defaultVisible, defaultOrder, render), `data`, `defaultSort`
- Carrega prefs via TanStack Query; mescla com defaults
- Aplica filtro (contains, case-insensitive) e ordenação client-side
- Cabeçalho com ícone de filtro (Popover + Input) e seta de ordenação
- Botão "Colunas" com Popover contendo lista drag-and-drop (`@dnd-kit/sortable`) + switches de visibilidade + selector de ordenação padrão
- Debounce 400ms ao salvar (mutation com invalidate)
- `Restaurar padrão` = deleta a linha de prefs e recarrega
- Mantém capacidade de "linhas extras" (totalizadores de grupo da tela Rotas) via prop `renderGroupFooter`

### Migração das telas
Cada tela passa a declarar suas colunas em um array e renderiza `<DataTable .../>`. Lógica específica (agrupamentos da tela Rotas, badges de status, links de detalhe) vira `render` de coluna ou prop. As funcionalidades atuais (totalizadores por Data Planejada, status por linha, etc.) são preservadas.

### Dependências
`@dnd-kit/core` + `@dnd-kit/sortable` (drag-and-drop acessível, leve).

## Ordem de entrega
1. Migração + server functions de preferências
2. Componente `DataTable` + Popover de colunas + filtros + persistência
3. Aplicar em **Pedidos** e **Rotas** (validação visual com você)
4. Aplicar nas demais (Clientes, Produtos, Fretistas, Usuários, Borderôs, Minhas Rotas)

Confirma para eu começar pela migração?
