# Cadastrar no ERP as rotas criadas pelo app

## Causa (confirmada)
1. A janela "Nova rota" da tela Rotas Pendentes grava a rota só no app e mostra "Rota criada". Ela nunca chama o ERP.
2. A criação de rota pela tela "Pedidos sem rota" chama o ERP com um nome de comando errado (`insert_capa_rota`) e lê o número da rota no lugar errado. Pela documentação enviada, o correto é `insert_ger_rota`, com o número devolvido em `outBinds.id_rota`. Por isso, essas rotas também ficavam sem número do ERP.

## O que muda
1. As duas telas passam a gravar a capa da rota no ERP com `POST /v1/execute/insert_ger_rota`. São enviados data (`yyyyMMdd`), nome em maiúsculas, nome do responsável, código do responsável (como número) e status "P".
2. O app lê o número oficial em `outBinds.id_rota` e o grava na rota do app. Assim, a sincronização e o vínculo dos pedidos passam a funcionar.
3. Em "Nova rota", se o ERP recusar ou não devolver o número, **a rota não é criada no app**. A mensagem de erro do ERP aparece na tela, por exemplo "Bind obrigatório ausente: ...". Se der certo, o aviso fica "Rota {nº ERP} criada no ERP".
4. Em "Pedidos sem rota", se o ERP falhar, a rota também não é criada. Os pedidos continuam selecionados, e o usuário vê o erro.

## Classificação
PATCH (1.14.3). Corrige uma integração que estava errada. Sem migração no banco.

## Riscos
Grava de verdade no ERP de produção, que é o comportamento esperado. Rotas criadas antes desta correção continuam só no app. Elas podem ser recriadas manualmente.

## Detalhes técnicos
- `src/lib/pedidos-sem-rota.functions.ts`:
  - Criar o helper `criarCapaRotaErp(nova)`, que chama `executarErp("insert_ger_rota", ...)`, converte `cod_frt_trp` com `Number()` (ou `null`) e extrai `outBinds.id_rota`. Se não vier número, lança erro.
  - Usar esse helper em `atribuirPedidosARota`, que hoje usa `insert_capa_rota`. A falha deixa de ser só um aviso e passa a gerar erro.
  - Criar a nova server function `criarRotaErp` (com `requireSupabaseAuth` e `ensureStaff`). Ela chama o helper e insere em `routes` com `erp_route_id`, `erp_status: "P"`, `erp_carrier_code`, `driver_name`, `total_freight: 0` e `notes: "Rota {NOME}"`.
- `src/components/routes/RotasView.tsx` (diálogo Nova rota, por volta das linhas 2054-2076): trocar o insert direto por `useServerFn(criarRotaErp)`.
- Atualizar `version.ts` e `CHANGELOG.md`.

## Checklist para publicar
- Criar uma rota em cada tela e conferir no ERP que o número mostrado no app é o mesmo.
- Migrações: nenhuma. Flags: nenhuma.
- Para reverter: voltar para a v1.14.2 pelo histórico.
