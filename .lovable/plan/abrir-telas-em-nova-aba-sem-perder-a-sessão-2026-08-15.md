# Abrir telas em nova aba sem perder a sessão

## Por que a autenticação é pedida de novo

Quando o app roda dentro do preview do Lovable, ele fica em um iframe. O navegador isola (particiona) o armazenamento desse iframe: a sessão gravada lá não é visível para uma aba de nível superior aberta com o mesmo endereço. Resultado: a nova aba não encontra a sessão e cai em `/auth`.

No app publicado (aberto direto no navegador, sem iframe) o armazenamento é o mesmo, e a nova aba mantém a sessão normalmente.

## Solução

Criar um utilitário único de "abrir em nova aba" usado por todo o app, com comportamento adaptado ao contexto:

- **App em aba normal (publicado ou aberto fora do preview):** abre em nova aba, como hoje.
- **App dentro do preview (iframe):** navega na própria tela do app, sem nova aba — assim a sessão é sempre preservada e o usuário nunca vê a tela de login.

Aplicar esse utilitário em todos os pontos que hoje abrem novas janelas/abas de telas internas do app:

- Lista de CT-e (clique na linha para o detalhamento)
- Detalhamento do CT-e (links para o CT-e original e para NF-e)
- Qualquer outra navegação interna futura que precise de nova aba

Links para arquivos/URLs externas (por exemplo, download de arquivo de tabela de frete assinado, comprovantes de entrega, mapas) continuam abrindo em nova aba normalmente, pois não dependem da sessão do app.

## Detalhes técnicos

- Novo `src/lib/open-in-tab.ts`:
  - `isEmbeddedPreview()` → `window.self !== window.top`.
  - `openAppRoute(router, path)` → se embutido, `router.navigate({ href: path })`; caso contrário, `window.open(origin + path, "_blank", "noopener,noreferrer")`.
- Substituir os `window.open` de rotas internas por esse helper em:
  - `src/routes/_authenticated/ctes.index.tsx` (`onRowClick`)
  - `src/routes/_authenticated/ctes.$cteId.tsx` (`openCteInWindow`)
  - `src/components/ctes/CteDetailView.tsx` (links internos de CT-e/NF-e)
- `src/routes/_authenticated/tabelas-frete.tsx` (URL assinada de arquivo) permanece com `window.open` — é conteúdo externo ao roteador.
