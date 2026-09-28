# Fretista da rota 426 não aparece

## O que foi confirmado
- No ERP, a rota 426 (M- METRO 1) tem o fretista **ROBSON FERNANDO DA SILVA (código 202487)**.
- Esse fretista já existe no cadastro local de responsáveis do app.
- Mas a rota 426 gravada no app está **sem fretista, sem nome de motorista e sem código do responsável**.

## Por que acontece
- A sincronização com o ERP nunca grava o código do responsável na rota. Ela só guarda o nome do motorista, e pega esse nome **do primeiro pedido da rota**. Se esse pedido veio sem motorista (por exemplo, o fretista foi informado depois), a rota fica vazia.
- A tela tenta compensar consultando o ERP na hora, mas essa consulta é lenta e, quando estoura o tempo, é descartada em silêncio. Aí a rota aparece sem fretista.

## O que vou fazer
1. Na sincronização, gravar o **código do responsável** e o **nome do motorista** na rota, usando o primeiro valor preenchido entre todos os pedidos da rota (não só o primeiro pedido).
2. Atualizar esses dados também em rotas que já existem, quando o ERP trouxer um responsável e a rota estiver vazia ou diferente.
3. Na tela, usar o código gravado na rota como reserva quando a consulta ao ERP não responder a tempo.
4. Rodar a sincronização e conferir que a rota 426 mostra "ROBSON FERNANDO DA SILVA (202487)" em Rotas Pendentes e em Autorizar pagamento de frete.

## Detalhes técnicos
- `src/lib/erp-sync.server.ts`: no agrupamento por `ID_ROTA`, preencher `driver`/`carrierCode` com o primeiro valor não vazio do grupo; incluir `erp_carrier_code` no insert e no update das rotas (update também para rotas ativas existentes).
- `src/components/routes/RotasView.tsx` (`codResponsavelPorRota`): fallback `codRota ?? r.erp_carrier_code ?? transportadora local`; incluir `erp_carrier_code` no select da listagem.
- Sem mudanças de banco: a coluna `erp_carrier_code` já existe em `routes`.
