# Abrir o detalhamento da rota clicando na linha

## Situação atual

Na listagem de rotas, só o texto da data planejada é um link para o detalhamento (`/rotas/{id}`). O restante da linha não é clicável.

## O que será feito

- Clicar em qualquer ponto da linha da rota (tabela no PC e card no celular) abre o detalhamento daquela rota.
- O cursor muda para "mão" e a linha ganha destaque ao passar o mouse, indicando que é clicável.
- Controles interativos dentro da linha (campo de frete, botões, badges de status, seleção de transportadora) continuam funcionando normalmente, sem abrir o detalhamento ao serem usados.
- O cabeçalho de grupo por data continua apenas expandindo/colapsando, sem navegar.
- A data planejada deixa de ser um link separado e passa a ser apenas texto, já que toda a linha navega.

## Detalhes técnicos

- `src/routes/_authenticated/rotas.index.tsx`: passar `onRowClick={(r) => navigate({ to: "/rotas/$routeId", params: { routeId: r.id } })}` ao `DataTable` (usando `useNavigate` do TanStack Router).
- Na coluna `route_date`, trocar o `<Link>` por um `<span>`/fragmento com o mesmo conteúdo responsivo.
- Nas células com controles (frete/valor editável, ações), envolver o conteúdo com `onClick={(e) => e.stopPropagation()}` para não disparar a navegação.
- `DataTable.tsx` já aplica `cursor-pointer` e `hover:bg-muted/40` quando `onRowClick` existe; nenhuma alteração estrutural é necessária nele.
