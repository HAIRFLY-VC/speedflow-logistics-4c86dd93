# Corrigir "Substituir pelos novos valores" no provisionamento de frete (PATCH 1.42.2)

## Causa
O comando `update_status_provisao` cadastrado na API do ERP atualiza **uma linha por vez** (`WHERE ID = :id`). O app envia `status` + `id_rota`, então o ERP recusa com "Bind obrigatório ausente: id" e nada é gravado.

## O que muda
Ao clicar em "Substituir pelos novos valores":
1. O app busca no ERP os IDs das linhas **ativas** (status A) daquela rota.
2. Marca cada uma como substituída (status S), enviando `status` + `id` da linha — em lotes de 5, como já é feito na gravação.
3. Confere de novo no ERP que não sobrou nenhuma linha ativa da rota. Só então grava os novos valores.
4. Se alguma linha falhar, a gravação nova não acontece e a mensagem diz quantas linhas foram substituídas e quantas falharam, para tentar de novo (repetir o clique é seguro: só as linhas ainda ativas são processadas).

A primeira gravação (rota sem provisionamento anterior) continua igual.

## Riscos para a versão publicada
- Sem migração no banco do app. No ERP, apenas troca de status A→S das linhas da própria rota, exatamente o que a função já se propunha a fazer.
- Nenhuma mudança de cálculo nem de tela além da mensagem de erro.

## Detalhes técnicos
- `src/lib/provisao-frete.server.ts` (`gravarProvisao`): substituir a chamada única por
  - `/v1/query`: `select id from gks.a_ger_provisao_frete where id_rota = :id and status = 'A'` (binds `{ id: idRota }`, mesmo padrão de `consultarProvisaoGravada`);
  - `Promise.allSettled` em lotes de 5 chamando `/v1/execute/update_status_provisao` com `{ status: "S", id }`;
  - nova consulta de verificação; abortar se restarem linhas ativas.
- Atualizar o comentário do comando em `db/erp/2026-10-08_a_ger_provisao_frete_v3.sql` para refletir o cadastro real (`WHERE ID = :id`, binds `status`, `id`).
- `src/config/version.ts` → 1.42.2; entrada no `CHANGELOG.md` (Corrigido).

## Checklist para publicar
- Testar no preview: rota 507 → lápis → Recalcular → "Substituir pelos novos valores"; o aviso de divergência deve sumir e o total gravado passar a R$ 355,78.
- Migrações: nenhuma.
- Flags: nenhuma.
- Reversão: voltar à 1.42.1; no ERP, se necessário, reativar linhas com `UPDATE ... SET STATUS='A' WHERE ID IN (...)` e marcar as novas como S.
