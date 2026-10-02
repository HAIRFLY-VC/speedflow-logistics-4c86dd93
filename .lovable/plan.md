# Rotas 433 e 434 aparecendo em Rotas Pendentes

## O que foi encontrado
- No ERP, as rotas 433 e 434 estão com status **E** e não têm nenhum pedido.
- No app, as duas ainda estão com status **P**. O Sync ERP não atualiza o status de uma rota que deixou de vir na consulta de pendentes: ela fica com o último status que recebeu.
- Até a v1.16.11, elas ficavam escondidas porque também tinham a marca "borderô emitido". Na v1.16.12, rotas com essa marca e sem nenhum borderô nos pedidos passaram a aparecer em Rotas Pendentes (correção da rota 457), e por isso as duas voltaram a aparecer.
- O mesmo vale para outras **28 rotas** que são E no ERP e P no app: 392, 411, 414, 416, 419–429, 432–434, 436–443, 446 e 468. Hoje elas não aparecem só por causa da marca de borderô.
- As rotas 475 e 476 nem existem mais no ERP.
- A rota 457 continua P no ERP, então ela está certa em Rotas Pendentes.

## O que muda (PATCH v1.16.13)
1. **Sync ERP**: a cada sincronização, o app confere no ERP o status de todas as rotas do app que ainda estão com status P e grava o status atual. Rotas que não existem mais no ERP passam para E.
2. **Rotas Pendentes**: continua mostrando só rotas com status P. Com o item 1, as rotas com status E no ERP saem da lista automaticamente.
3. **Correção imediata**: gravar status E no app para as 28 rotas listadas acima e para a 475 e a 476. Só o status muda: pedidos, pagamentos e tarefas do Bitrix ficam como estão.
4. Atualizar a versão e o CHANGELOG.

## Riscos
- O item 3 muda dados no banco compartilhado (vale para teste e oficial). A tela "Autorizar pagamento de frete" não usa esse status, então as rotas já pagas ou com borderô (como 423 e 442) continuam lá.
- Para reverter: gravar de novo o status P nessas mesmas rotas.

## Detalhes técnicos
- `erp-sync.server.ts`: nova etapa que roda `select ID, STATUS from GKS.A_GER_ROTAS where ID in (...)` em lotes de até 500 IDs, com as rotas locais `erp_status = 'P'`. Em seguida faz `update speedflow.routes set erp_status = <STATUS>` só quando o status mudou. IDs que não voltarem do ERP recebem 'E'. Se essa consulta falhar, a sincronização não para: a falha fica registrada nos erros da execução.
- Correção dos dados pela API do banco central: `update routes set erp_status='E' where erp_route_id in (...)`.
