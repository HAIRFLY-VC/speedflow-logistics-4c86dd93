# Nova rota: reservar o ID no ERP antes de cadastrar (PATCH v1.15.5)

## O que muda
Ao clicar em "Criar rota" (telas Rotas Pendentes e Pedidos sem rota):
1. O app pede ao ERP o próximo número de rota (`select gks.SEQ_ROTA_ID.nextval from dual`).
2. Envia esse número como `id` na gravação da rota no ERP, junto com data, nome, motorista, código do fretista e status `P`.
3. Se o ERP confirmar (`rowsAffected` = 1), a rota é registrada no app com esse mesmo número.
4. Se qualquer passo falhar, nada é gravado no app e o usuário vê a mensagem do ERP.

## Riscos
- Números reservados e não usados (falha na gravação) deixam "buracos" na sequência — comportamento normal de sequência Oracle.
- Sem alteração de banco nem de flags.

## Detalhes técnicos
- `src/lib/pedidos-sem-rota.functions.ts` → `criarCapaRotaErp`:
  - novo helper `proximoIdRotaErp()` via POST `/v1/query` `{ sql, binds: {}, limit: 1 }`, lendo `NEXTVAL` da primeira linha (tolerante a maiúsc./minúsc.); erro se vazio/não numérico.
  - `insert_ger_rota` passa a enviar `id: String(idRota)`; sucesso validado por `rowsAffected >= 1` (não depende mais de `outBinds.id_rota`); retorna o ID reservado.
- Ambas as telas já usam essa função; nenhuma mudança visual.
- `version.ts` → 1.15.5 e entrada no `CHANGELOG.md`.

## Checklist para publicar
- Testar no preview a criação de uma rota e conferir o número no ERP.
- Nenhuma migração; reversão: voltar à versão anterior no histórico.
