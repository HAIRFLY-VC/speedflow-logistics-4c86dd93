# Acesso ao menu lateral por usuário

## Como vai funcionar
- Em "Usuários e Papéis", cada usuário ganha um botão "Menu" que abre uma janela com todos os itens do menu lateral (Dashboard, Kanban, Pedidos, Rotas Pendentes, Autorizar pagamento de frete etc.), cada um com uma caixa de marcação.
- O administrador marca/desmarca os itens e salva. Há atalhos "Marcar todos", "Desmarcar todos" e "Voltar ao padrão do papel".
- Enquanto nada for personalizado, o usuário continua vendo o menu padrão do seu papel (como hoje). Depois de salvo, ele vê apenas os itens marcados.
- Itens exclusivos de administrador (Usuários, Empresas, Config. de fretes, Captura de CT-e, Pendências de integração) só podem ser liberados para usuários com papel Administrador.
- Administradores sempre mantêm acesso a "Usuários", para ninguém se trancar fora.
- Se o usuário tentar abrir pelo endereço uma tela que não foi liberada, verá a mensagem "Você não tem acesso a esta tela" com link para o início.
- Na listagem de usuários aparece a indicação "Menu personalizado" ou "Padrão do papel".

## Detalhes técnicos
- Migração: tabela `public.user_menu_access (user_id uuid, menu_url text, primary key(user_id, menu_url))` + tabela/flag `user_menu_custom(user_id)` para distinguir "personalizado vazio" de "padrão". GRANTs para `authenticated`/`service_role`, RLS: usuário lê as próprias linhas; `has_role(auth.uid(),'adm')` lê e grava todas.
- Extrair a lista `NAV` de `AppShell.tsx` para `src/lib/menu-items.ts` (compartilhada pelo menu e pela tela de usuários).
- `useAuth` (ou hook novo `useMenuAccess`) carrega os itens liberados; `AppShell` filtra `NAV` por papel e, se personalizado, pela lista salva.
- Guarda de tela: componente em `AppShell` que compara a rota atual com os itens liberados (subrotas como `/rotas/$id` herdam de `/rotas`).
- `usuarios.tsx`: novo diálogo `MenuAccessDialog` em `src/components/usuarios/`, com gravação direta via cliente (RLS de admin).
