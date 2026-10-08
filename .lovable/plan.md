# Provisionamento: consultar o gravado, recalcular e substituir (MINOR v1.28.0)

## O que muda na tela "Provisionar frete"
1. **Ao abrir**, o app consulta no ERP se a rota já tem provisionamento ativo (status 'A' em `GKS.A_GER_PROVISAO_FRETE`).
2. **Já existe gravado:** mostra os valores gravados (por nota, agrupados por entrega, com a composição salva na memória de cálculo), data e usuário da gravação. Botão de gravar fica oculto.
3. **Não existe:** calcula pela tabela de frete e habilita "Gravar provisionamento no ERP".
4. **Botão "Recalcular"** (quando já há gravado): calcula de novo pela tabela atual — útil quando a tabela estava cadastrada errada — e mostra lado a lado gravado x atual por nota, com a diferença.
5. **Divergência automática:** ao abrir, o app também calcula em segundo plano e, se o total ou alguma nota diferir do gravado, mostra um aviso vermelho "Provisionamento gravado diverge do cálculo atual" e libera o botão "Substituir pelos novos valores".
6. **Substituir:** pede confirmação, marca as linhas antigas como 'S' e grava as novas com o status 'A'.

## Ordem da gravação no ERP
- Primeira gravação: não chama `update_status_provisao` (evita o erro atual). Para cada nota busca `GKS.SEQ_PROVISAO_FRETE.NEXTVAL` e executa `insert_provisao_frete` com esse `id`.
- Substituição: chama `update_status_provisao` (binds `status`, `id_rota`) e depois insere as novas linhas como acima.
- No fim confere a quantidade gravada e marca a rota como "Confirmado" com o novo total.

## Riscos
- A substituição depende de `update_status_provisao` cadastrado com os binds `status` e `id_rota` (hoje está esperando `id`). Se não for ajustado, a primeira gravação funciona, mas a substituição mostra erro claro e nada é alterado.
- Sem migração no banco do app; sem flag nova (política: oficial = teste).

## Detalhes técnicos
- `src/lib/provisao-frete.server.ts`: nova `consultarProvisaoGravada(idRota)` via `/v1/query` (linhas ativas, valores, memória CLOB, data, usuário); `previewProvisao` retorna `gravado` + `calculado` + `divergente`; `gravarProvisao(routeId, { substituir })` com update condicional.
- `src/lib/provisao-frete.types.ts` e `provisao-frete.functions.ts`: novos campos e parâmetro.
- `src/components/routes/ProvisaoFreteDialog.tsx`: modos "gravado", "novo cálculo" e "comparação", botões Recalcular / Gravar / Substituir.
- `src/config/version.ts` → 1.28.0 e `CHANGELOG.md`.

## Checklist para publicar
- Rota 453 no preview: abrir (sem gravado) → gravar → reabrir (exibe gravado) → alterar tabela → reabrir (aviso de divergência) → substituir.
- Ajustar no ERP o `update_status_provisao` para os binds `status` e `id_rota`.
- Reverter: versão 1.27.4 no histórico do Lovable.
