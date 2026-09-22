# Simular rotas que ainda não têm borderô

Objetivo: trazer para a base os pedidos das rotas que já saíram (agenda 417/427, motorista 1830, saída a partir de 22/09/2026) como se ainda estivessem pendentes e sem borderô. Assim, na próxima sincronização normal do ERP eles não voltam mais e o app os marca automaticamente como "Borderô emitido", buscando o número do borderô por pedido.

## O que será feito (uma vez só)

1. Rodar no ERP exatamente a consulta que você enviou, com `BORDERO`, `DT_BORDERO` e `STATUS_BORDERO` nulos e o filtro final `dt_saida_bordero >= 22/09/2026 e cod_motorista = 1830`.
2. Gravar esses pedidos e suas rotas na base do app usando a mesma lógica da sincronização normal, tratando `DT_SAIDA_BORDERO` como se fosse nulo (pedido pendente, sem borderô).
3. Onde já existir o mesmo pedido ou a mesma rota, os dados são sobrescritos com os da simulação.
4. As rotas criadas ficam como pendentes, com `bordero_emitido_em` em branco, aparecendo em "Rotas Pendentes".
5. Conferir na tela que as rotas apareceram e reportar quantos pedidos e rotas foram gravados.

## Como verificar depois

Ao clicar em "Atualizar rotas" numa próxima sincronização, essas rotas não voltarão do ERP (porque já têm borderô de verdade). O app então:
- marca a rota com o selo "Borderô emitido" e a tira de Rotas Pendentes;
- busca `MAX(BORDERO)` por pedido e grava o número em cada pedido;
- remove pedidos que não retornarem borderô nenhum (e a rota, se ficar vazia);
- passa a exibir a rota em "Autorizar pagamento de frete".

## Detalhes técnicos

- Script temporário executado no sandbox (não fica no projeto): chama a API do ERP (`/v1/query`) com a consulta acima e grava via o cliente do banco central (`orders`, `route_orders`, `routes`), reaproveitando o mesmo mapeamento de campos de `src/lib/erp-sync.server.ts` (`buildOrderPayload`, montagem de rotas por `ID_ROTA`/`NOME_ROTA`).
- Nenhuma alteração no código do app, no schema ou nas telas.
- `orders.bordero` fica nulo e `routes.bordero_emitido_em` fica nulo nessa carga — é justamente o estado "ainda sem borderô" que queremos simular.
