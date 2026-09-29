# Corrigir "Rota não encontrada" ao atribuir pedidos a uma rota existente

## Causa (confirmada)
A cada sincronização com o ERP (automática ou pelo botão "Sync ERP"), as rotas pendentes são apagadas e criadas de novo no app. Cada vez, elas ganham um identificador interno novo. A rota "T- ALAGOAS" (ERP 423) foi recriada às 13:15. A tela ainda guardava o identificador antigo e, ao confirmar, o servidor não encontrava mais a rota. A rota continua existindo e pode ser encontrada pelo número do ERP (423).

## Classificação
PATCH: v1.8.4. Não mexe no banco, não cria flag e não muda integrações.

## O que muda
1. Ao escolher uma rota existente, a tela envia também o **número da rota no ERP** e o código da rota, além do identificador interno.
2. O servidor procura primeiro pelo identificador interno. Se a rota tiver sido recriada, procura pelo número do ERP e depois pelo código. Assim, a atribuição funciona mesmo se houver uma sincronização no meio.
3. O servidor só mostra "Rota não encontrada" se a rota realmente não existir mais, por exemplo quando o borderô já foi emitido. A tela continua atualizando a lista nesse caso.

## Detalhes técnicos
- `src/routes/_authenticated/pedidos-sem-rota.tsx`: incluir `erp_route_id` no select de `rotasQ` e enviar `routeErpId` e `routeCode` na chamada de `atribuirPedidosARota`.
- `src/lib/pedidos-sem-rota.functions.ts`: aceitar `routeErpId` e `routeCode` opcionais e buscar nesta ordem: `id`, depois `erp_route_id` (status planejada/em_andamento), depois `code`. Passar a usar o `id` encontrado nas gravações em `route_orders` e no retorno.
- Atualizar `src/config/version.ts` e `CHANGELOG.md`.

## Risco
Baixo. A atribuição só passa a achar a rota certa quando ela foi recriada. Os vínculos gravados continuam os mesmos.
- Limitação conhecida: a sincronização recria as paradas das rotas a partir do ERP. Por isso, os pedidos precisam ser vinculados no ERP (isso já acontece hoje) para continuarem na rota depois da próxima sincronização.

## Checklist para publicar
- No preview: atribuir pedidos à rota "T- ALAGOAS". Depois clicar em "Sync ERP" sem reabrir o painel, atribuir outra vez e confirmar que funciona.
- Migrações: nenhuma. Flags: nenhuma.
- Para desfazer: voltar à v1.8.3 no histórico.
