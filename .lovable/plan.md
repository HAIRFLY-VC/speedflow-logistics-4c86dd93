# Corrigir perda de sessão ao abrir o detalhamento do CT-e

## O problema

Hoje, clicar em uma linha da lista de CT-e chama `window.open` para uma nova janela do navegador. No ambiente de preview (e em qualquer caso em que o app roda dentro de um iframe), a origem usada nessa nova janela não é a mesma origem em que a sessão do usuário está guardada. Resultado: a nova janela abre sem sessão e o app redireciona para a tela de login em vez do detalhamento.

## Correção proposta

Abrir o detalhamento dentro da própria aplicação, em tela cheia, mantendo a sessão:

- Trocar o `window.open` da lista de CT-e por navegação normal do app para `/ctes/{id}` (mesma aba), usando o roteador.
- A página de detalhamento já existe e ocupa a tela inteira; ela ganha um botão "Voltar" claro para a listagem.
- Suporte a Ctrl/Cmd+clique e clique do meio continua funcionando como link normal do navegador (abre em nova aba já autenticada quando a origem for a mesma), sem forçar `window.open`.
- Os hiperlinks internos do detalhamento (CT-e original, NF-e) passam a usar o mesmo modo de navegação, sem abrir janelas novas.

## Detalhes técnicos

- `src/routes/_authenticated/ctes.index.tsx`: substituir o handler `onRowClick` que usa `window.open`/`window.screen` por `navigate({ to: "/ctes/$cteId", params: { cteId: c.id } })`.
- `src/routes/_authenticated/ctes.$cteId.tsx`: garantir botão de retorno para `/ctes` e verificar o estado de carregamento.
- `src/components/ctes/CteDetailView.tsx`: ajustar o `linkMode` para navegação no app (sem `window.open`) quando renderizado na rota de detalhamento.
