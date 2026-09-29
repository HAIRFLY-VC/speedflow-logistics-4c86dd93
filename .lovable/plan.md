# Gestor pode lançar valor adicional na rota

Classificação: **MINOR** (v1.7.0) — amplia permissão sem quebrar fluxo existente.

## Estado atual (confirmado no código)
- Em `src/lib/rota-pagamento.server.ts` (linha 455), a regra `(jaConfirmado || tipo === "ADICIONAL") && !isAdmin` bloqueia tanto a reabertura do frete quanto o lançamento adicional para quem não é administrador.
- Em `src/components/routes/PagamentoRotaDialog.tsx`, a opção "Valor adicional" e o botão só aparecem quando `isAdmin` é verdadeiro.
- Gestor já pode confirmar o pagamento normal do frete (verificação `podeAutorizar` em `rota-pagamento.functions.ts`).

## O que vai mudar
1. **Servidor** (`rota-pagamento.functions.ts` / `rota-pagamento.server.ts`):
   - Passar também `isGestor` para `confirmarPagamentoRota`.
   - Nova regra: lançamento **ADICIONAL** permitido para administrador **ou gestor**; **reabrir/substituir o frete** de rota já confirmada continua exclusivo do administrador.
2. **Tela** (`PagamentoRotaDialog.tsx`):
   - Receber `isGestor` e exibir a opção "Valor adicional" (motivo, valor, seleção de notas) para gestor.
   - Manter a reabertura do frete (tipo FRETE em rota confirmada) visível só para administrador.
   - Ajustar textos de bloqueio conforme o caso.
3. **Versionamento**: `src/config/version.ts` → v1.7.0 e entrada no `CHANGELOG.md`. Sem feature flag nova (flags vão ligadas em produção por padrão).

## O que NÃO muda
- Regras de PIX, vínculo Bitrix, auditoria completa e borderô continuam valendo para o adicional.
- Reabrir pagamento confirmado continua só para administrador.
- Nenhuma migração de banco.

## Riscos
- Baixo: apenas amplia quem pode lançar adicional; a gravação no ERP e a tarefa no Bitrix seguem o mesmo fluxo já existente.

## Checklist para publicar
- No preview, com um usuário Gestor: abrir uma rota com pagamento confirmado, lançar um adicional e conferir ERP + tarefa no Bitrix.
- Confirmar que um Gestor **não** consegue reabrir/substituir o frete principal.
- Confirmar que Operador/Fretista continuam sem a opção.
- Sem migrações e sem flags a ligar.
- Reversão: voltar à versão anterior pelo histórico do Lovable.
