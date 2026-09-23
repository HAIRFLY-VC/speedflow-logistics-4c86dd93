# Pedidos do ERP sem rota e sem data de expedição não aparecem

## O que foi visto no código
- A sincronização grava esses pedidos com data de expedição vazia (quando o ERP não traz rota nem data).
- A tela "Pedidos sem rota" busca pedidos com data vazia **ou** data 4000-01-01, mas:
  - não exclui pedidos já expedidos (status 11-EXPEDIDO) nem cancelados;
  - ordena pelo número do pedido em ordem crescente e para em **1000 registros**.
- Resultado provável: pedidos antigos/expedidos ocupam as 1000 vagas e os pedidos novos (números maiores) ficam de fora. A causa ainda será confirmada contando os registros no banco antes de mudar o código.

## O que vou fazer
1. **Confirmar a causa**: contar no banco os pedidos com data vazia, quantos estão expedidos e se os pedidos novos do ERP foram de fato gravados. Se algum pedido não estiver gravado, investigar a sincronização em vez da tela.
2. **Filtrar só pedidos em aberto**: a tela passa a ignorar pedidos com status expedido e os que já estão ligados a alguma rota no app.
3. **Remover o corte de 1000**: buscar em páginas até trazer todos, ordenando do mais recente para o mais antigo.
4. **Sincronização**: garantir que pedidos sem rota no ERP sempre fiquem com data vazia (limpando data/nome de rota antigos quando o ERP deixa de trazê-los), para que voltem à tela.
5. Validar abrindo a tela e conferindo que os pedidos citados aparecem.

## Detalhes técnicos
- `src/routes/_authenticated/pedidos-sem-rota.tsx`: adicionar `.neq("erp_status","11-EXPEDIDO")`, excluir ids presentes em `route_orders`, paginar com `.range()` em lotes de 1000, `order("order_number",{ascending:false})`.
- `src/lib/erp-sync.server.ts` (`buildOrderPayload`): já envia `dt_prev_exp`/`nome_rota` nulos; conferir se o upsert não mantém valores antigos e se a linha "NÃO PLANEJADO" não vincula esses pedidos a uma rota que os esconda.
