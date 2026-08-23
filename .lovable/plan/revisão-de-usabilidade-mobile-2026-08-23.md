# Revisão de usabilidade mobile

O sistema hoje é desenhado para desktop: tabelas largas, cabeçalhos densos, diálogos grandes e barras de ação em linha. No celular isso gera rolagem horizontal, textos cortados e botões pequenos demais para o toque.

## O que será feito

### 1. Estrutura geral (menu e cabeçalho)
- Menu lateral abre como painel deslizante no celular e fecha automaticamente ao escolher uma tela.
- Cabeçalho compacto: título encurtado, botões de sincronizar/notificações com área de toque de no mínimo 44x44.
- Conteúdo com espaçamento menor no celular para aproveitar a largura.

### 2. Listagens (o ponto mais crítico)
O componente de tabela usado por quase todas as telas ganha um modo celular:
- Cada registro vira um cartão empilhado (rótulo + valor), sem rolagem horizontal.
- Barra de busca em largura total; filtros e gerenciador de colunas agrupados num botão "Filtros" que abre por baixo.
- Ordenação por um seletor simples em vez de clique no cabeçalho.
- Toque no cartão abre o detalhamento, como o clique na linha hoje.

Telas cobertas: CT-e, Pedidos, Rotas, Clientes, Fretistas, Transportadoras, Tabelas de frete, Auditoria, Pagamento de fretes, Borderôs, Empresas, Usuários.

### 3. Cards de resumo e dashboard
- Grades passam a 1–2 colunas no celular, com números legíveis e sem quebra estranha de texto.

### 4. Detalhamentos e diálogos
- Detalhamento de CT-e, Pedido e Rota: cabeçalho em blocos empilhados, badges de status com toque confortável, tabelas internas (NF-es, auditoria) roláveis dentro de um contêiner próprio.
- Diálogos/modais ocupam quase toda a tela no celular, com rolagem interna e botões de ação fixos no rodapé.

### 5. Formulários e mapas
- Campos em coluna única, botões de ação em largura total.
- Mapas de rota/sugestão com altura adequada ao celular e controles maiores.

### 6. Kanban
- Colunas com rolagem horizontal por "swipe" e largura de cartão adequada ao dedo.

## Detalhes técnicos
- Usar o hook existente `useIsMobile` para alternar entre tabela e cartões em `src/components/data-table/DataTable.tsx` (sem alterar as definições de coluna já existentes em cada tela).
- Ajustes de layout com utilitários responsivos do Tailwind (`grid-cols-[minmax(0,1fr)_auto]`, `min-w-0`, `truncate`, `shrink-0`), sem tocar em regra de negócio.
- Alvos de toque mínimos de 44px em botões de ícone; `h-dvh` no lugar de `h-screen`.
- Nenhuma mudança de banco, consultas ou fluxos de integração.

## Validação
Conferência das telas principais em viewport de celular (390px) com capturas antes/depois.
