# Detalhe da rota editável apenas enquanto pendente

## Objetivo
A tela de detalhamento da rota (`/rotas/:id`) só permite alterações enquanto a rota estiver **pendente**: status "planejada" e ainda **sem borderô emitido no ERP** (`bordero_emitido_em` vazio). Fora dessa condição, a tela vira somente leitura.

## O que muda na tela

Uma rota é considerada editável quando:
- `status = planejada`, e
- `bordero_emitido_em` está vazio (ainda não saiu do ERP com borderô).

Quando a rota **não** estiver pendente:
- O botão **Editar** (canto superior) fica oculto — hoje ele aparece para qualquer rota com vínculo ao ERP, mesmo já iniciada, concluída ou com borderô emitido.
- O seletor de **fretista interno** fica oculto (já ocorre para status diferente de planejada; passa a valer também para borderô emitido).
- O bloco **Adicionar pedido à rota** fica oculto (mesma regra acima).
- O botão **Cancelar** fica oculto; os demais botões de fluxo (Iniciar/Concluir rota, Emitir borderô) continuam seguindo as regras atuais de status.
- É exibido um aviso discreto informando que a rota não está mais pendente e não pode ser editada (ex.: "Rota com borderô emitido no ERP — edição bloqueada").

Todas as demais informações (responsável pelo frete, resumo, mapa, pedidos, borderô) continuam visíveis normalmente.

## Detalhes técnicos
- `src/routes/_authenticated/rotas.$routeId.tsx`:
  - Ampliar a query da rota para trazer `bordero_emitido_em`.
  - Trocar `const editable = route.status === "planejada"` por `route.status === "planejada" && !route.bordero_emitido_em`.
  - Condicionar o botão "Editar" a `editable` (além de `erp_route_id`).
  - Condicionar o botão "Cancelar" a `editable`.
  - Exibir o aviso de bloqueio quando `!editable`.
- `RouteEditDialog`: nenhuma mudança de conteúdo; apenas deixa de ser acessível quando a rota não está pendente.
- Sem mudanças de banco de dados ou de outras telas.

## Validação
- Typecheck e build.
- Conferir uma rota pendente (edição liberada) e a rota 414 "M- ARCOMIX" (borderô emitido — edição bloqueada com aviso).
