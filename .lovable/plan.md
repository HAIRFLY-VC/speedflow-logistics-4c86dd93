# Correção da coluna Data planejada na visualização PC

## Problema
Na tela de rotas (`/rotas`), a coluna "Data planejada" continua exibindo valor total e peso total além da data quando a visualização é em PC/desktop. O comportamento correto deve ser:
- **PC/desktop**: exibir apenas a data.
- **Mobile**: exibir "Total {data} · R$ {valor} · {peso} kg".

## Causa
A função `groupBy.label` em `src/routes/_authenticated/rotas.index.tsx` sempre retorna a string completa com valor e peso, sem considerar o breakpoint de tela. O ajuste anterior corrigiu apenas o `render` das linhas individuais, mas não o cabeçalho dos grupos colapsados.

## Solução
1. Em `src/routes/_authenticated/rotas.index.tsx`, alterar a função `groupBy.label` para retornar um `ReactNode` responsivo:
   - Em telas `sm` ou maiores: exibir apenas `formatRouteDate(key)`.
   - Em telas menores que `sm`: manter o padrão atual `Total {data} · R$ {valor} · {peso} kg`.
2. Reutilizar as classes utilitárias `hidden sm:inline` e `inline sm:hidden` para alternar o conteúdo sem duplicar a linha de grupo.

## Arquivos envolvidos
- `src/routes/_authenticated/rotas.index.tsx`
