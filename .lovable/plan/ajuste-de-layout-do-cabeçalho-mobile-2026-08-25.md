# Ajuste de layout do cabeçalho mobile

## Objetivo
Na visualização mobile, reposicionar o botão de menu (hambúrguer) para ficar ao lado esquerdo do sino de notificações, mantendo o logo/título alinhado à esquerda.

## Alteração proposta
Em `src/components/layout/AppShell.tsx`, ajustar o `header` para que:
- **Desktop**: layout atual se preservado — menu à esquerda, logo/título ao centro, sino à direita.
- **Mobile**: a ordem seja — logo/título à esquerda, botão de menu, sino de notificações à direita.

Isso será feito com classes responsivas do Tailwind (`sm:`), movendo o `SidebarTrigger` para a coluna da direita em telas pequenas e mantendo-o à esquerda em telas maiores.

## Arquivos alterados
- `src/components/layout/AppShell.tsx`

## Critério de aceitação
- No preview mobile, o cabeçalho exibe: logo/título à esquerda, botão de menu e sino de notificação à direita, nessa ordem.
- No preview desktop, o cabeçalho permanece com o menu à esquerda do logo/título.
