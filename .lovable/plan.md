# Pedidos da rota sempre iguais ao ERP (começando pela rota 422)

## Objetivo
Na tela "Autorizar pagamento de frete", o app confere se os pedidos de cada rota batem com o ERP e, se não baterem, ajusta o app para ficar igual ao ERP. A rota 422 é o primeiro caso.

## O que será feito
1. **Diagnóstico da rota 422**
   - Buscar no ERP os pedidos da rota 422 e comparar com o que o app mostra.
   - Identificar os pedidos a mais (ou a menos) e a origem de cada um. A causa ainda não foi confirmada.
2. **Conferência automática na tela de autorização**
   - Ao abrir a tela e ao abrir o lápis de uma rota, o app consulta no ERP os pedidos da rota.
   - Pedido que está no app e não está no ERP: sai da rota no app.
   - Pedido que está no ERP e não está no app: é incluído na rota no app.
   - O ajuste só mexe no app; nada é alterado no ERP.
   - Aparece um aviso discreto quando a rota foi ajustada (ex.: "Rota ajustada ao ERP: 2 removidos, 1 incluído").
   - Se o ERP não responder, o app mantém os dados atuais e mostra "Não foi possível conferir com o ERP", sem travar a tela.
3. **Sincronização**
   - A sincronização geral também passa a remover da rota os pedidos que saíram dela no ERP.
4. **Validação**
   - Rota 422 com a mesma quantidade de pedidos do ERP no detalhe, na listagem e no lápis; auditoria refeita.

## Detalhes técnicos
- Nova função de servidor para reconciliar uma rota (ou lote de rotas visíveis) com `gks.A_GER_ROTAS_PEDIDOS`: calcula diferença, remove/insere vínculos locais e recalcula totais/auditoria.
- Chamada no carregamento de `RotasView` (modo autorizar), em lote e com tempo limite, e ao abrir `PagamentoRotaDialog`.
- Ajuste em `src/lib/erp-sync.server.ts` para apagar vínculos locais ausentes no ERP.
- Rotas com pagamento já confirmado: apenas mostram aviso de divergência, sem ajuste automático.
- Atrás de feature flag (ligada em teste, desligada em produção). Sem migração. Versão MINOR (v1.5.0) + CHANGELOG.
