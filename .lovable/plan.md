# Atribuir pedidos a uma nova rota: gravar no ERP com a API correta

Classificação: PATCH (v1.16.3). Não muda o banco.

## Situação atual
- Na aba "Nova rota", a capa da rota já segue o processo certo: reserva o ID com `SEQ_ROTA_ID.nextval`, chama `insert_ger_rota` e só continua se a gravação der certo.
- Para vincular os pedidos no ERP, o app usa um comando antigo (`insert_rota_pedido`, com os campos `id_rota`/`pedido`), que não é o da documentação enviada. Por isso os pedidos não chegam ao ERP.

## O que muda
1. **Nova rota**: a ordem continua a mesma. Primeiro reserva o ID, depois grava a capa. Se der erro, para tudo e não grava nada no app.
2. Com a capa gravada, cada pedido é incluído no ERP com `POST /v1/execute/insert_pedido_na_rota`, enviando `{ idrota, codpedido }`. Considera sucesso só quando `rowsAffected >= 1`.
3. **Rota existente** usa a mesma API, para os dois fluxos ficarem iguais.
4. Se um pedido falhar no ERP, ele não é vinculado no app e aparece no aviso com o motivo, sem mostrar o PIX. Os pedidos que deram certo ficam na rota. Assim o app e o ERP não ficam diferentes.
5. A mensagem final mostra quantos pedidos foram incluídos no ERP e quantos falharam.

## Detalhes técnicos
- Em `src/lib/pedidos-sem-rota.functions.ts` (`atribuirPedidosARota`):
  - troca `executarErp("insert_rota_pedido", {id_rota, pedido})` por `executarErp("insert_pedido_na_rota", { idrota: Number(erpRouteId), codpedido: Number(erp_id ?? order_number) })` e confere `rowsAffected`;
  - muda a ordem: primeiro inclui no ERP e depois grava `route_orders` e atualiza `orders`, somente para os pedidos aceitos;
  - na rota nova, se nenhum pedido for aceito pelo ERP, a rota continua criada e o app mostra um aviso claro.
- Atualizar `src/config/version.ts` para 1.16.3 e registrar no `CHANGELOG.md`.

## Checklist para publicar
- No teste, atribuir 1 ou 2 pedidos a uma nova rota e confirmar em `GKS.A_GER_ROTAS_PEDIDOS` que eles foram gravados com o novo ID.
- Testar com uma rota existente.
- Sem migrações e sem flags.
- Para reverter, use a versão anterior no histórico. Pedidos já incluídos no ERP precisam ser removidos com `delete_pedido_da_rota`.
