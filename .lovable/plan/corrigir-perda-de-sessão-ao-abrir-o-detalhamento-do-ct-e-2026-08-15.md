# Corrigir perda de sessão ao abrir o detalhamento do CT-e

## O problema

Hoje, clicar em uma linha da lista de CT-e chama `window.open` para uma nova janela do navegador. No ambiente de preview, a nova janela perde a sessão do usuário e cai na tela de autenticação em vez de exibir o detalhamento.

## Correção proposta

Abrir o detalhamento em uma nova aba do navegador (não uma nova janela), mantendo a origem atual e, portanto, a sessão do Supabase:

- Substituir o `window.open` atual — que calcula tamanho e posição de uma nova janela — por `window.open(url, '_blank')` na listagem de CT-e.
- Manter a nova aba apontando para `/ctes/{id}` na mesma origem, para que o `localStorage` da sessão seja compartilhado.
- Garantir que os hiperlinks internos do detalhamento (CT-e original, NF-e) também usem a mesma abordagem ou navegação normal do app.
- A página de detalhamento `/ctes/$cteId.tsx` já possui botão de retorno para `/ctes`; não haverá alterações estruturais nela.

## Detalhes técnicos

- `src/routes/_authenticated/ctes.index.tsx`: substituir o handler `onRowClick` que usa `window.open` com `features` baseados em `window.screen` por `window.open(url, '_blank')`.
- `src/routes/_authenticated/ctes.$cteId.tsx`: sem alterações necessárias.
- `src/components/ctes/CteDetailView.tsx`: sem alterações necessárias.

