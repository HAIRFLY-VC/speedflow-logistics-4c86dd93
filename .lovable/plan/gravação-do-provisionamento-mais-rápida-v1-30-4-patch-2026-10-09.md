# Gravação do provisionamento mais rápida (v1.30.4, PATCH)

## Onde o tempo é gasto hoje (lido no código)
Ao clicar em "Gravar provisionamento no ERP", o app:
1. Refaz o cálculo inteiro da rota (consulta ERP, notas, transportadora, tabela e provisionamento gravado), mesmo já estando calculado na tela.
2. Para cada nota, faz **duas chamadas em fila** ao ERP: pede o próximo número da sequência e depois grava a linha. Rota com 20 notas = 40 chamadas uma após a outra.
3. Confere a contagem no ERP e atualiza a rota.

## O que muda
1. **Números da sequência de uma vez só**: uma única consulta traz todos os IDs necessários (`select seq.nextval from dual connect by level <= N`).
2. **Gravação em paralelo**: as notas são enviadas em lotes de 5 ao mesmo tempo (limite seguro do servidor), em vez de uma por vez.
3. **Medição**: registra a duração de cada etapa nos logs do servidor, para confirmar o ganho.
4. **Progresso na tela**: o botão mostra "Gravando 12 de 20 notas…" em vez de apenas girar.

O cálculo continua sendo refeito no servidor antes de gravar (garante que o valor gravado é o correto e mantém todos os bloqueios). A conferência final de contagem também permanece.

## Ganho esperado
Rota com 20 notas: de ~41 chamadas em fila para ~1 + 4 lotes paralelos — algo como 5 a 8 vezes mais rápido na etapa de gravação.

## Riscos
- Se uma nota falhar no meio, as outras já podem ter sido gravadas (hoje acontece o mesmo). A mensagem dirá quantas foram gravadas, e "Substituir pelos novos valores" refaz tudo.
- Carga momentânea maior na API do ERP (máx. 5 simultâneas).
- Sem mudança no banco do app nem no Oracle.

## Checklist para publicar
- No preview: gravar o provisionamento de uma rota com várias notas (ex.: 443) e conferir as linhas na `GKS.A_GER_PROVISAO_FRETE`.
- Testar também "Substituir pelos novos valores".
- Reverter: versão anterior no histórico do Lovable.

## Detalhes técnicos
- `src/lib/provisao-frete.server.ts` `gravarProvisao`: substituir `proximoId()` por loop por uma query `connect by level <= :n`; pool de 5 com `Promise.allSettled` sobre `insert_provisao_frete`; reportar falhas agregadas; `console.time` por etapa.
- Progresso: como a gravação é uma única chamada, o indicador mostra etapas estimadas ("Calculando…", "Gravando N notas…") em `ProvisaoFreteDialog.tsx`.
- `version.ts` e `CHANGELOG.md`.
