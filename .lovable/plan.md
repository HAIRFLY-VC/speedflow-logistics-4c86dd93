# Rota 459 fora de "Autorizar pagamento de frete"

## Diagnóstico (confirmado no ERP e no app)
- No ERP: a rota 459 "M- ATAC AL" tem o fretista JEFFERSON DE FREITAS (código 205613) e **36 pedidos**. Todos estão faturados, no borderô 32489, e saíram hoje às 08:22.
- No app: a rota existe, mas **sem nenhum pedido e sem fretista**.
- Causa: o Sync ERP só traz pedidos que **ainda não saíram** com o borderô. A rota foi montada e expedida entre dois Syncs, então os 36 pedidos nunca entraram no app. Sem pedidos, a tela de autorização esconde a rota.
- O mesmo pode acontecer com qualquer rota montada e expedida rápido. A 423 teve esse problema antes.

## O que será feito
1. **Sync ERP completa rotas sem pedidos**: se uma rota tem ID do ERP, não tem pedidos no app e não foi cancelada, o Sync busca no ERP os pedidos dela, mesmo os já expedidos. Ele importa cada pedido com borderô, data de saída, valor, peso e cliente, e vincula a rota.
2. **Fretista/transportadora**: no mesmo passo, o app vincula o responsável pelo código do ERP (`COD_FRT_TRP`), se ainda estiver faltando.
3. **Correção imediata da 459**: rodar esse passo na rota 459. Ela deve aparecer em "Autorizar pagamento de frete" com 36 pedidos, o borderô 32489 e o fretista Jefferson.
4. Conferir se outras rotas recentes têm o mesmo problema, e corrigir todas no mesmo passo.
5. Versão PATCH (1.29.2) e entrada no CHANGELOG.

## Detalhes técnicos
- `src/lib/erp-sync.server.ts`: novo passo depois dos pedidos pendentes. Ele seleciona rotas com `erp_route_id`, sem `route_orders` e com status diferente de cancelada ou E. Depois consulta `A_GER_ROTAS_PEDIDOS` + `ERP_PEDIDOS_EXPEDICAO_PENDENTE` sem o filtro `DT_SAIDA_BORDERO IS NULL`, mantendo os filtros de agenda, cliente e devolução. Os pedidos entram pelo mesmo mapeamento já usado (upsert por pedido) e os vínculos são criados.
- O passo processa até 50 rotas por vez e tem tempo limite, para não deixar o Sync mais lento.
- Sem migração de banco. Ele só grava pedidos e vínculos que já existem no ERP, no banco compartilhado.

## Checklist para publicar
- Preview: rodar o Sync ERP e conferir a rota 459 (36 pedidos, fretista, borderô) na tela de autorização.
- Migrações: nenhuma.
- Flags: nenhuma.
- Reverter: pelo histórico do Lovable. Os pedidos importados correspondem aos do ERP e podem ficar.
