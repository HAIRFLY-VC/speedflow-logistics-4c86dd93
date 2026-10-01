# Excluir rota sem pedidos + Rotas Pendentes só com status P — v1.16.0 (MINOR)

## Rotas Pendentes: somente status P
A tela Rotas Pendentes passa a listar apenas rotas cujo status no ERP é **P**. Rotas com outros status (E, borderô emitido etc.) deixam de aparecer ali. A tela "Autorizar pagamento de frete" não é afetada.
- Técnico: em `RotasView.tsx`, nova opção `somenteStatusP` (ligada em `/rotas`, incluída na chave do cache) filtrando `erp_status = 'P'` na consulta. Rotas criadas pelo app já gravam `erp_status = 'P'`. Antes de ativar, conferir a distribuição atual de `erp_status` para verificar se rotas legítimas não têm o status vazio; se tiverem, o Sync ERP passa a preenchê-lo.

## O que muda
Na tela de detalhe da rota, quando a rota tiver **0 pedidos**, aparece o botão vermelho **"Excluir rota"** (ao lado de "Iniciar rota" / "Cancelar").
- Ao clicar, abre uma confirmação: "Excluir a rota {nome} (ERP {id})? Esta ação marca a rota como Excluída no ERP."
- Ao confirmar, o app grava no ERP o status **E** na rota. Só depois de o ERP confirmar, a rota é removida do app e o usuário volta para Rotas Pendentes, já sem ela na lista.
- Se o ERP recusar ou falhar, nada é removido no app e aparece a mensagem de erro com o código da requisição.
- Disponível para Administrador e Gestor (mesmos perfis que atribuem responsável).

## Proteções
- No servidor, o app reconfere se a rota realmente não tem pedidos antes de chamar o ERP (no app e no ERP, via auditoria de pedidos da rota). Se tiver, bloqueia com mensagem.
- Rota sem ID do ERP: é removida só do app (sem chamada).
- O Sync ERP passa a ignorar rotas com status E, para que ela não volte.

## Detalhes técnicos
- Nova server fn `excluirRotaVazia` (em `src/lib/rota-erp.functions.ts`, `requireSupabaseAuth` + checagem `adm`/`gestor`): conta `route_orders`; consulta pedidos no ERP (`A_GER_ROTAS_PEDIDOS`); chama `POST /v1/execute/update_status_rota` com binds `{ status: "E", id }`; exige `rowsAffected >= 1`; depois apaga `delivery_manifests` e `routes` no banco central.
- `src/routes/_authenticated/rotas.$routeId.tsx`: botão + AlertDialog, invalida as consultas de rotas e navega para `/rotas`.
- `src/lib/erp-sync.server.ts`: descartar linhas com `STATUS = 'E'` ao montar as rotas.
- Versão 1.16.0 + CHANGELOG. Sem migração; sem flag (política: oficial = teste).

## Checklist para publicar
- Preview: abrir uma rota vazia (ex.: 433), excluir, confirmar no ERP status E e sumiço da lista; rodar Sync ERP e confirmar que não volta.
- Abrir rota com pedidos: botão não aparece.
- Reversão: no ERP, voltar status para P (`update_status_rota` com status P); a rota reaparece no próximo Sync.
