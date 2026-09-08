# Exportar para Excel e visões de filtro salvas

## O que muda para o usuário

Na tela "Entregas em aberto", acima do grid:

- **Exportar Excel**: gera um arquivo `.xlsx` com exatamente o que está no grid — mesmas colunas, mesma ordem, mesmos filtros aplicados e uma linha final com os totais (entregas, valor, peso). Nome do arquivo com data/hora.
- **Visões de filtro**: um seletor com as combinações de filtro salvas.
  - "Salvar visão atual" pede um nome e guarda os filtros + ordenação do momento.
  - Escolher uma visão aplica os filtros na hora.
  - Renomear, atualizar (sobrescrever com os filtros atuais) e excluir as próprias visões.
  - O último estado continua sendo lembrado automaticamente, como hoje.
- **Compartilhar**: no menu de cada visão própria, "Compartilhar" abre uma lista de usuários ativos com caixas de seleção. Quem for marcado passa a ver a visão numa seção "Compartilhadas comigo", podendo usá-la mas não editá-la nem excluí-la. É possível remover pessoas depois.

## Detalhes técnicos

### Banco (Lovable Cloud)

Duas tabelas novas, com RLS e GRANTs:

- `table_filter_views`: `id`, `owner_id`, `table_key`, `name`, `definition jsonb` (`{ columnFilters, sort }`), `created_at`, `updated_at` (trigger de updated_at). Único por (`owner_id`, `table_key`, `name`).
- `table_filter_view_shares`: `id`, `view_id` (FK cascade), `shared_with` (FK auth.users), `created_at`. Único por (`view_id`, `shared_with`).

Políticas: dono faz tudo na sua visão e nos seus compartilhamentos; destinatário só lê a visão compartilhada e o próprio registro de compartilhamento. Função `security definer` `public.can_read_filter_view(_view_id uuid, _user_id uuid)` para evitar recursão entre as duas tabelas.

### Server functions

Novo `src/lib/filter-views.functions.ts` (todas com `requireSupabaseAuth`):
`listFilterViews` (próprias + compartilhadas, com nome do dono), `saveFilterView` (cria/atualiza), `renameFilterView`, `deleteFilterView`, `setFilterViewShares` (lista de user_ids), `getFilterViewShares`. Reaproveitar a listagem de usuários já existente em `src/lib/users.functions.ts` para o seletor de pessoas.

### Frontend

- `src/components/data-table/FilterViewsBar.tsx`: seletor de visões (agrupado em "Minhas" / "Compartilhadas comigo"), diálogo de salvar/renomear e diálogo de compartilhamento com busca de usuários.
- `src/components/data-table/export-xlsx.ts`: utilitário que recebe cabeçalhos, linhas já formatadas e nome do arquivo, e monta o `.xlsx` no navegador (biblioteca `xlsx`, importada de forma preguiçosa para não pesar a tela). Datas como texto no formato exibido, valor e peso como número.
- `src/routes/_authenticated/entregas-abertas.tsx`: reutiliza o descritor de colunas já existente para montar linhas de exportação a partir da lista filtrada/ordenada; adiciona a barra de visões e o botão de exportar; aplicar uma visão chama `setFiltro`/`setSort` do `useColumnFilterPrefs`, mantendo a persistência automática atual.

Componentes genéricos (`FilterViewsBar`, `export-xlsx`) ficam parametrizados por `tableKey`, para reuso em outros grids depois.
