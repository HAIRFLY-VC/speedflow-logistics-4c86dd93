# Mover botão de expandir/comprimir menu lateral

## Objetivo
Na visualização desktop (PC), remover o botão de menu atual localizado no canto superior direito e substituí-lo por uma seta intuitiva no canto superior esquerdo, alinhada ao menu lateral, para expandir ou comprimir o menu.

## Alterações
1. Em `src/components/layout/AppShell.tsx`:
   - Remover o `SidebarTrigger` com ícone `Menu` do canto superior direito do header para telas desktop (`md:`).
   - Manter o controle de notificações e o botão de sync ERP no lado direito do header.
   - Em mobile, o menu continuará acessível (manter um gatilho de sidebar para telas pequenas, se necessário).
2. Adicionar, no topo do menu lateral (`SidebarHeader`), um botão de seta para expandir/comprimir:
   - Usar `PanelLeftClose` quando o menu estiver expandido (seta/indicando comprimir).
   - Usar `PanelLeftOpen` quando o menu estiver recolhido (seta/indicando expandir).
   - Posicionar o botão no canto superior direito do cabeçalho da sidebar, alinhado à lista de navegação.
   - Manter `title` e `aria-label` descritivos em português.
3. Garantir que a responsividade continue funcionando: em telas pequenas o menu se comporta como sheet/drawer; em desktop é colapsável.

## Fora do escopo
- Nenhuma alteração na estrutura de navegação ou nos itens do menu.
- Nenhuma alteração nas permissões por papel.
- Nenhuma alteração no rodapé do menu lateral (botão "Comprimir/Expandir" existente permanece).
