# Auditoria de rota completa na tela "Autorizar pagamento de frete"

## O que muda para o usuário

Ao abrir ou atualizar a tela, o app confere no ERP, para cada rota exibida, se **todos os pedidos da rota** já têm nota fiscal expedida e em aberto (mesma regra da sua consulta).

- **Rota completa**: selo verde "Rota completa (X/X)". O botão **Confirmar Pgto** funciona normalmente.
- **Rota incompleta** (ex.: rota 416): selo âmbar "Rota incompleta (X de Y pedidos)". O botão **Confirmar Pgto** fica bloqueado, com a explicação ao passar o mouse, e há uma lista dos pedidos que faltam (pedido e motivo: sem nota, sem data de saída, já entregue ou status diferente de "A").
- Se o ERP não responder, o selo mostra "Auditoria indisponível" e o botão fica bloqueado até a conferência dar certo (botão "Conferir de novo").
- A mesma conferência roda de novo dentro da janela de confirmação, logo antes de gravar, para evitar confirmar uma rota que ficou incompleta nesse intervalo.

## Como funciona a conferência

Para as rotas da tela, em um único lote:

1. Pedidos da rota: `GKS.A_GER_ROTAS_PEDIDOS` (P.ID = rota).
2. Pedidos válidos: a sua consulta (`A_GER_ROTAS` + `A_GER_ROTAS_PEDIDOS` + `A_GERENTREGAS` com `STATUS='A'`, `DT_SAIDA` preenchida, `DT_ENTREGA_CLI` vazia), com `R.ID IN (...)`.
3. Rota completa = todos os pedidos do passo 1 aparecem no passo 2.

## Detalhes técnicos

- `src/lib/rota-erp.functions.ts`: nova server fn `auditarRotasCompletas({ routeIds })` (autenticada) que executa as duas consultas em lote no ERP (helper existente, sem duplicar `/v1/query`) e retorna por rota `{ total, completos, faltantes: [{ pedido, motivo }] }`. O motivo vem de uma terceira leitura leve em `A_GERENTREGAS` dos pedidos faltantes (sem registro = sem nota).
- `src/components/routes/RotasView.tsx`: quando `permitirConfirmacao` (só a tela de autorização), consulta `auditarRotasCompletas` com as rotas filtradas (`erp_route_id`), exibe selo + popover de faltantes e passa `auditoriaOk` para o `FreightInput`; Confirmar Pgto exige `auditoriaOk`.
- `src/lib/rota-pagamento.server.ts`: `confirmarPagamentoRota` (e a prévia) chamam a mesma auditoria no servidor e recusam com mensagem "Rota incompleta no ERP: faltam os pedidos …" — proteção mesmo se a tela estiver desatualizada. Valor adicional/reabrir não é afetado.
- Rotas Pendentes não mudam. Nenhuma alteração de banco.

## Verificação

- tsgo e build OK.
- Conferir que a rota 416 aparece como incompleta com os pedidos faltantes e botão bloqueado; rota 414 como completa.
