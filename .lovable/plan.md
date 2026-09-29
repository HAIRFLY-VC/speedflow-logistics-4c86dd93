# Menu lateral automático (v1.1.2 — PATCH)

## Causa provável
Hoje o recurso só age quando o menu está **recolhido e salvo assim** na preferência do usuário. Se o menu está aberto (preferência salva como "aberto", que é o padrão), passar o mouse não faz nada e ele nunca recolhe sozinho — por isso parece não funcionar.

## O que muda
- No computador (tela ≥ 768px), com o recurso ligado, o menu passa a ficar **sempre recolhido** e expande ao passar o mouse, recolhendo ao sair — independente da preferência salva.
- O botão de abrir/fechar menu do topo vira "fixar aberto": clicado, mantém o menu aberto até clicar de novo (continua salvo na preferência).
- Ao expandir pelo mouse, o menu sobrepõe a tela sem empurrar a tabela (comportamento atual mantido).
- Celular sem mudança. Produção continua desligada pela feature flag.

## Detalhes técnicos
- `AppShell.tsx`: introduzir estado `pinned` separado; quando a flag está ativa no desktop, ignorar `open` salvo por padrão (iniciar recolhido) e usar `pinned || hoverOpen` no `SidebarProvider`; remover a condição `if (open) return` em `onSidebarEnter`.
- Verificar com Playwright: passar o mouse sobre o menu (expande), sair (recolhe), clicar no botão (fica fixo).
- Atualizar `src/config/version.ts` para 1.1.2 e `CHANGELOG.md`.

## Checklist para publicar
- Testar no preview em computador: passar/sair o mouse e fixar.
- Sem migração de banco; flag segue desligada em produção.
- Reverter pela versão anterior no histórico.
