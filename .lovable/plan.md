# Rota 422 — pedidos a mais no app em relação ao ERP

## Objetivo
Fazer a rota 422 (e qualquer outra com o mesmo problema) mostrar no app exatamente os pedidos que estão vinculados a ela no ERP.

## Passos
1. **Diagnóstico (ainda não confirmado)**
   - Consultar no ERP os pedidos da rota 422 (`gks.A_GER_ROTAS_PEDIDOS where id = 422`).
   - Comparar com os pedidos que o app mostra para a rota 422 (vínculos locais + pedidos com `nome_rota` apontando para ela).
   - Listar os pedidos que sobram no app e descobrir a origem de cada um. Hipóteses a testar: pedido removido da rota no ERP mas o vínculo local ficou; pedido associado pelo nome da rota em vez do código; pedido que mudou de rota e ficou nas duas.
2. **Correção na sincronização**
   - Quando a sincronização trouxer os pedidos da rota, remover do app os vínculos que não existem mais no ERP (hoje a lógica só inclui ou atualiza).
   - Associar pedido à rota pelo código da rota do ERP, e não pelo nome.
3. **Limpeza pontual**
   - Remover da rota 422 no app somente os vínculos que não existem no ERP (lista mostrada antes de aplicar), e verificar se outras rotas têm o mesmo problema.
4. **Validação**
   - Abrir a rota 422 no detalhe e na tela de pagamento e confirmar a mesma quantidade de pedidos do ERP.
   - Refazer a auditoria da rota.

## Detalhes técnicos
- Arquivos prováveis: `src/lib/erp-sync.server.ts` (sincronização de rotas/pedidos), `src/lib/rota-erp.functions.ts` (auditoria/detalhe).
- Nenhuma migração de estrutura; a limpeza só apaga vínculos locais inconsistentes. Não altera nada no ERP.
- Versão PATCH (v1.4.1) + CHANGELOG.
