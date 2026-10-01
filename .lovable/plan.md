# Cadastrar no ERP a rota criada pelo botão "Nova rota"

## Causa (confirmada)
A janela "Nova rota" da tela Rotas Pendentes grava a rota apenas no app e mostra "Rota criada". Ela nunca chama o ERP. Só a criação de rota pela tela "Pedidos sem rota" envia a capa da rota ao ERP.

## O que muda
1. Ao clicar em "Criar rota", o app cria primeiro a capa da rota no ERP (`insert_capa_rota`) com data, nome em maiúsculas, código e nome do responsável e status "P".
2. Se o ERP recusar, **a rota não é criada no app** e aparece a mensagem de erro do ERP. Isso evita uma rota "fantasma" que existe só no app.
3. Se der certo, a rota é gravada no app com o número oficial do ERP, e o aviso fica "Rota {nº ERP} criada no ERP".
4. Se o ERP aceitar mas não devolver o número da rota, a rota é gravada mesmo assim, com um aviso claro de que o vínculo com o ERP precisa ser conferido.

## Classificação
PATCH (1.14.3). Corrige um comportamento errado. Sem migração no banco.

## Riscos
Grava de verdade no ERP de produção, como já acontece na tela "Pedidos sem rota". Rotas criadas antes da correção continuam só no app. Elas podem ser reenviadas depois, se você quiser.

## Detalhes técnicos
- Nova server function `criarRotaErp` em `src/lib/pedidos-sem-rota.functions.ts`. Ela reaproveita `executarErp`, `ensureStaff`, a extração do id e `slugRota`. Também insere em `routes` com `erp_route_id`, `erp_status: "P"`, `erp_carrier_code`, `driver_name` e `notes: "Rota {NOME}"`.
- `RotasView.tsx` (diálogo Nova rota, por volta das linhas 2054-2076) passa a usar `useServerFn(criarRotaErp)` em vez do insert direto.
- Atualizar `version.ts` e `CHANGELOG.md`.

## Checklist para publicar
- Criar uma rota de teste e conferir se ela aparece no ERP com o mesmo número mostrado no app.
- Migrações: nenhuma. Flags: nenhuma.
- Para reverter: voltar para a v1.14.2 pelo histórico.
