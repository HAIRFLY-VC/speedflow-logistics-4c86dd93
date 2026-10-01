# Regularizar rotas cadastradas só no app

## Diagnóstico (confirmado)

Consulta ao banco central mostrou 57 rotas no app; 55 têm vínculo com o ERP (`erp_route_id`, maior = 469). Apenas 2 não existem no ERP:

| Rota | Data | Responsável | Pedidos | Criada em |
|---|---|---|---|---|
| `rota-teste-20261001` | 01/10/2026 | SANDRO NEVES PEREIRA | 0 | 01/10/2026 08:38 |
| `nao-planejado-40000101` | 01/01/4000 (sentinela) | — | 2 | 28/09/2026 |

- `rota-teste-20261001` é a rota que você cadastrou antes da correção: o app disse "sucesso" mas nunca chamou o ERP. Está vazia (sem pedidos).
- `nao-planejado-40000101` é o agrupamento interno "NÃO PLANEJADO" — não é uma rota real e não deve ir ao ERP.

## O que fazer

1. **Rota `rota-teste-20261001`** (escolher uma opção):
   - **Opção A — Recadastrar no ERP:** chamar `insert_ger_rota` (status "P", responsável Sandro Neves Pereira), gravar o `erp_route_id` retornado na rota local e atualizar o `code` para `erp-<id>`, mantendo a rota existente.
   - **Opção B — Excluir:** apagar a rota local (está vazia) e você a recria pela tela, agora com a gravação no ERP já corrigida (v1.14.3).
2. **Rota `nao-planejado-40000101`:** nenhuma ação — é estrutural do app.

## Classificação

PATCH (correção de dados pontual, sem mudança de comportamento).

## Riscos

- Nenhum para a versão publicada: a correção v1.14.3 já faz novas rotas irem ao ERP.
- Opção A grava uma rota real no ERP; Opção B remove apenas um registro local vazio.

## Checklist para publicar

- Testar no preview: criar uma rota nova e conferir o número gerado no ERP.
- Migrações: nenhuma.
- Flags: nenhuma.
- Reverter: não se aplica (ajuste de dados); o histórico do Lovable cobre o código.
