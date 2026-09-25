# Alinhar o aviso "Rota incompleta" da listagem com o detalhamento

## O problema
Na rota 419, a listagem mostra "Rota incompleta (7 de 14 pedidos)". Já o detalhamento aberto pelo lápis mostra 12 pedidos, todos com nota e borderô.

Os dois usam regras diferentes para decidir se um pedido está ok:
- **Listagem (auditoria):** só aceita o pedido se a nota estiver **em aberto**: saiu, ainda não foi entregue e está com status "A" no ERP. Um pedido já entregue ou com outro status conta como faltante.
- **Detalhamento:** aceita todo pedido da rota que tem nota fiscal e borderô, esteja entregue ou não.

Com isso, pedidos corretos e já entregues aparecem como faltantes na listagem.

## Correção
1. **Confirmar os números da 419 antes de mudar qualquer coisa.** Vou ver quais são os 7 pedidos "faltantes" e o motivo de cada um, e de onde vem a diferença entre 14 e 12. Por exemplo, um pedido pode estar duplicado ou cancelado no ERP.
2. **Mudar a regra da auditoria para a mesma do detalhamento.** Um pedido da rota passa a contar como ok quando tem nota fiscal emitida e borderô, mesmo que já tenha sido entregue.
3. Continuam como faltantes na listagem:
   - pedido sem nota fiscal;
   - pedido sem borderô;
   - pedido que existe na rota no ERP mas não foi encontrado.
   O motivo de cada um aparece ao passar o mouse, como hoje.
4. O total da listagem ("X de Y pedidos") passa a contar os mesmos pedidos que o detalhamento mostra.

## Como vou validar
- Rota 419: a listagem deve mostrar o mesmo número de pedidos do detalhamento. Se estiver tudo certo, aparece "Rota completa" e o "Confirmar Pgto" fica liberado assim que o valor for informado.
- Rotas 414, 416 e 421: devem continuar com o mesmo resultado.

## Detalhes técnicos
- `src/lib/rota-auditoria.server.ts`: a consulta dos pedidos válidos tem hoje os filtros `G.STATUS='A' AND G.DT_SAIDA IS NOT NULL AND G.DT_ENTREGA_CLI IS NULL`. Ela passa a exigir `G.NRO_NF IS NOT NULL` e borderô preenchido. Se o ERP trouxer mais de uma linha para o mesmo pedido, fica valendo a de status "A".
- `motivoDe()`: os motivos passam a ser "Sem nota fiscal emitida", "Sem borderô" e "Não encontrado".
- A contagem de pedidos esperados (`A_GER_ROTAS_PEDIDOS`) deixa de repetir o mesmo pedido. Pedidos cancelados ficam de fora, se o passo 1 confirmar que é isso que explica 14 contra 12.
