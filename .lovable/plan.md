# Erro ao criar rota: falta de permissão no ERP

## Diagnóstico
O app chamou o ERP corretamente com `insert_ger_rota`. O Oracle recusou o pedido com **ORA-01031: insufficient privileges**. O usuário que a API do ERP usa no banco não tem permissão para gravar a rota. A falta pode estar na procedure, na tabela `A_GER_ROTAS` ou na sequência que gera o ID da rota.

O app agiu como deveria: a rota não foi criada no app, e nada ficou pela metade.

**O app não consegue corrigir isso.** A correção precisa ser feita pelo responsável pelo banco do ERP (DBA). Ele deve liberar para o usuário da API:
- EXECUTE na procedure de `insert_ger_rota`;
- INSERT em `GKS.A_GER_ROTAS`;
- SELECT na sequência do ID da rota, se houver uma.

Use o requestId `eb34b07e-7022-498f-9c66-ecee51d934eb` para localizar o erro no log da API do ERP.

## Melhoria no app (PATCH 1.15.5)
Hoje o erro aparece em formato técnico. Quando o ERP devolver ORA-01031, a mensagem passará a ser:
"O ERP recusou a gravação por falta de permissão do usuário da integração. Peça ao responsável pelo ERP para liberar o cadastro de rotas (ref. {requestId})."

Isso vale para "Nova rota" e "Pedidos sem rota".

## Detalhes técnicos
- `src/lib/pedidos-sem-rota.functions.ts`: em `criarCapaRotaErp`, identificar `ORA-01031` no texto de erro, extrair o `requestId` e lançar a mensagem amigável acima.
- Atualizar `version.ts` e `CHANGELOG.md`.
- Nenhuma migração e nenhuma flag.

## Checklist para publicar
- Depois que o DBA liberar a permissão, criar uma rota de teste e conferir o número do ERP.
- Para reverter: restaurar a v1.15.4 pelo histórico.
