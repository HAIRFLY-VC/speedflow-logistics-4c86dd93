# Provisionamento: só marcar como substituído quando já houver gravação (PATCH v1.27.5)

## O que muda
Ao clicar em "Gravar provisionamento no ERP":
1. O app consulta no ERP se a rota já tem provisionamentos ativos (`select count(*) from gks.a_ger_provisao_frete where id_rota = :id and status = 'A'`).
2. Só se houver linhas ativas ele chama `update_status_provisao` (marca as antigas como 'S'). Na primeira gravação esse passo é pulado — é ele que hoje causa o erro.
3. Para cada nota: busca o próximo número em `GKS.SEQ_PROVISAO_FRETE.NEXTVAL` e envia como `id` no `insert_provisao_frete` (como já faz hoje).
4. Ao final, confere a quantidade gravada e marca a rota como "Confirmado".

## Riscos
- Primeira gravação passa a funcionar mesmo com o `update_status_provisao` divergente no ERP.
- Num reprovisionamento, o `update_status_provisao` ainda precisa estar cadastrado com os binds `status` e `id_rota`; se continuar esperando `id`, o erro volta só nesse caso (aviso claro na mensagem).
- Sem migração no banco do app; sem flag nova.

## Detalhes técnicos
- `src/lib/provisao-frete.server.ts` → `gravarProvisao`: nova consulta de contagem antes do update; update condicional; mensagem de erro do update indica o ajuste de binds.
- `src/config/version.ts` → 1.27.5 e entrada no `CHANGELOG.md`.

## Checklist para publicar
- Gravar no preview o provisionamento da rota 453 e conferir as linhas em `GKS.A_GER_PROVISAO_FRETE` (IDs da sequência) e o status "Confirmado".
- Reverter: versão 1.27.4 no histórico do Lovable.
