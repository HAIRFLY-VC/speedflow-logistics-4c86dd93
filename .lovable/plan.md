# Considerar o borderô atual do pedido reexpedido (ex.: pedido 4135213, rota 422)

Classificação: PATCH (v1.5.1), correção de dado exibido e usado no pagamento.

## Problema
Quando um pedido volta por ocorrência, o ERP tem mais de uma linha para ele: a antiga (borderô 32309, status O de ocorrência) e a nova (borderô 32381). O app hoje:
- aceita qualquer linha com NF e borderô, sem olhar o status da ocorrência;
- grava o primeiro borderô encontrado e **nunca o substitui** depois (só preenche quando está vazio);
- no sync, usa o maior número de borderô só para pedidos ainda sem borderô.
Por isso o pedido 4135213 continua aparecendo com 32309 no lápis de "Autorizar pagamento de frete".

## O que muda
1. Regra única de escolha do borderô de um pedido na rota: descartar linhas cujo borderô está com status O (ocorrência); entre as restantes, usar a mais recente (data do borderô/saída, desempate pelo maior número).
2. A auditoria da rota passa a aplicar essa regra e **atualiza** o borderô gravado no app quando ele difere do atual do ERP (não só quando está vazio). NF, filial e valor seguem a mesma linha escolhida.
3. Pedido cujas únicas linhas são de borderô em ocorrência não conta como "faturado com borderô" (aparece como pendência na rota, com motivo "Borderô em ocorrência — aguardando novo borderô").
4. O lápis, a tarefa do Bitrix e a contagem de "sem borderô" usam o borderô corrigido.
5. Rotas com pagamento já confirmado: não alteramos o borderô gravado (mantém o que foi pago); apenas mostramos aviso se houver divergência.

## Primeiro passo (verificação)
Antes de codar, consultar no ERP as linhas do pedido 4135213 para confirmar qual coluna carrega o status "O" (status do borderô vs. status da entrega) e qual data define a mais recente. A regra acima será ajustada ao que a consulta mostrar.

## Riscos
- Banco compartilhado: ao abrir o lápis em preview, borderôs de pedidos reexpedidos serão atualizados de verdade no app (não no ERP). É a correção desejada, mas vale também para produção.
- Sem migração de banco; ERP não é alterado.

## Detalhes técnicos
- `src/lib/rota-auditoria.server.ts`: incluir `E.STATUS_BORDERO`/`DT_BORDERO` (ou coluna confirmada) na query de válidos; filtrar status O; escolher linha mais recente por pedido antes de montar `entregas`/`porPedido`; trocar o patch "se vazio" por "se diferente" (exceto rota com `frete_confirmado_em`).
- `src/lib/erp-sync.server.ts` (~186): trocar `MAX(G.BORDERO)` pela mesma regra.
- `src/lib/rota-pagamento.server.ts` (~153/196): priorizar o borderô vindo da auditoria/entrega atual em vez de `orders.bordero` antigo.
- Helper compartilhado `escolherLinhaAtual(rows)` para não duplicar a regra.
- Atualizar `src/config/version.ts` e `CHANGELOG.md`.

## Checklist para publicar
- Preview: abrir lápis da rota 422 e confirmar 4135213 com borderô 32381; conferir rota 421 sem mudanças.
- Migrações: nenhuma.
- Flags: nenhuma nova.
- Reverter: versão anterior no histórico; clicar "Conferir de novo" nas rotas afetadas.
