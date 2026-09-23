# Corrigir a checagem de borderô para pedidos sem rota e sem nota fiscal

## Resposta à pergunta (por que a consulta rodou)
A consulta de borderô em `GKS.A_GERENTREGAS` só deveria rodar para pedidos de rotas que saíram da lista de pendentes do ERP (borderô emitido). Ela rodou para os pedidos 4135466 e 4135465 porque eles estavam ligados a uma rota marcada como "Borderô emitido". Pelo que você descreveu, esses pedidos nunca tiveram rota nem nota fiscal — então foram parar na checagem por engano (provavelmente a rota de agrupamento "NÃO PLANEJADO" foi marcada em alguma sincronização).

## O que vou mudar
1. **A rota "NÃO PLANEJADO" nunca entra na lógica de borderô.** Ela não é uma rota real do ERP — é só o agrupamento dos pedidos que voltam do ERP sem rota e sem data de expedição. Hoje, se ela deixa de voltar em alguma sincronização, é marcada como "Borderô emitido" e todos os seus pedidos entram na checagem. Isso explica o caso que você viu.
2. **Só consultar borderô de pedido que já tem nota fiscal no ERP.** A consulta passa a trazer também o número do documento (NF). Pedido sem NF nunca tem borderô, então nem entra na consulta — continua aguardando, sem contar o prazo de 5 dias.
3. **Nunca excluir pedido sem NF.** A exclusão automática após 5 dias só vale para pedido com nota fiscal emitida que mesmo assim não ganhou borderô. Pedido sem NF fica guardado sem risco de sumir.
4. Rodar uma checagem no banco para confirmar como os pedidos 4135466/4135465 foram parar numa rota marcada e corrigir o estado deles (tirar da rota marcada, sem apagar nada).
5. Validar com uma sincronização e confirmar que a consulta de borderô não roda mais para esses pedidos.

## Detalhes técnicos
- `src/lib/erp-sync.server.ts`:
  - No agrupamento de rotas: excluir a rota sintética "NÃO PLANEJADO" (sem `erp_route_id`, data 4000-01-01) da lista `rotasComBorderoEmitido` — rota sem ID do ERP nunca é marcada como borderô emitido.
  - Em `tratarRotasComBorderoEmitido`: a consulta em `GKS.A_GERENTREGAS` passa a incluir `E.NR_DOCUMENTO`/`E.DT_EMISSAO` do pedido (join com a visão de pendentes ou checagem pelo app). Só pedidos com NF vão para o `IN (...)`. Pedido sem NF: `continue` antes da lógica de carência, ou seja, nunca entra em `semBordero`.
  - Investigar o estado atual no banco (rota marcada contendo 4135466/4135465) e limpar `bordero_emitido_em` dessa rota / remover os vínculos se for a "NÃO PLANEJADO".
