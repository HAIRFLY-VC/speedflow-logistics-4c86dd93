# Botão "Voltar" também nas telas do menu abertas a partir de outra tela (PATCH v1.23.1)

## Motivo
Na versão 1.23.0 o "Voltar" foi colocado só nas telas de detalhe (pedido, rota, CT-e, NF-e). "Pedidos sem rota" é uma tela do menu, mas também é aberta pelo card pulsante de "Rotas Pendentes", por isso ficou sem o botão. O mesmo acontece com outras telas do menu abertas por cards, notificações ou links internos (ex.: Autorizar pagamento, Entregas em aberto, Pendências de integração).

## O que muda
- Todas as telas do app passam a exibir "Voltar para <tela anterior>" no topo, logo acima do título, **sempre que o usuário chegou nela vindo de outra tela do app** (por card, link, notificação ou menu).
- Se a tela for aberta direto (primeira tela após login, nova aba, link externo), o botão não aparece nas telas do menu; nas telas de detalhe continua o retorno padrão já existente.
- Ao voltar, a tela anterior mantém filtros e posição.
- As telas de detalhe não ficam com dois botões: o botão próprio delas é mantido e o geral é ocultado nelas.

## Riscos
Somente navegação; sem impacto em banco, integrações ou permissões.

## Detalhes técnicos
- `AppShell.tsx`: renderizar um `BackButton` geral (modo sem fallback) acima do conteúdo quando houver tela anterior registrada e a rota atual não for de detalhe (`/pedidos/$`, `/rotas/$`, `/ctes/$`, `/nfes/$`, `/imprimir-rota/$`).
- `BackButton.tsx`: tornar `fallbackTo` opcional (sem fallback → não renderiza se não houver histórico); usar o caminho anterior registrado (não só `useCanGoBack`) para decidir exibição, evitando aparecer na primeira tela.
- Atualizar `version.ts` e `CHANGELOG.md`.

## Checklist para publicar
- Em Rotas Pendentes, clicar no card de pedidos sem rota e conferir "Voltar para Rotas Pendentes".
- Entrar pelo login direto no Dashboard: sem botão Voltar.
- Telas de detalhe com um único botão Voltar.
- Sem migrações nem flags. Reverter: v1.23.0 no histórico.
