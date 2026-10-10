# Frete mínimo na linha FRETE PESO

## Classificação
**PATCH — v1.41.1.** Ajuste na apresentação da auditoria do CT-e, sem alterar o total calculado.

## O que será alterado
- Quando o mínimo da praça for aplicado, remover da grade a linha separada **AJUSTE FRETE MÍNIMO**.
- Incorporar esse ajuste à linha **FRETE PESO**: o valor esperado dessa linha será a parcela necessária para que **FRETE PESO + FRETE VALOR** alcance exatamente o frete mínimo.
- Abaixo do valor de **FRETE PESO**, exibir em vermelho: **“Foi cobrado o frete mínimo de R$ X,XX em vez do valor calculado de R$ Y,YY.”**
- Manter normalmente as demais linhas, a comparação com o valor cobrado e os totais.
- Adaptar também auditorias já gravadas no formato antigo, juntando visualmente “AJUSTE FRETE MÍNIMO” a “FRETE PESO”; assim o CT-e mostrado no exemplo será corrigido sem alterar registros históricos.

## Exemplo do caso enviado
- Cálculo original: FRETE PESO **R$ 11,12** + FRETE VALOR **R$ 2,77**.
- Frete mínimo: **R$ 26,00**.
- Nova apresentação: FRETE PESO **R$ 23,23** + FRETE VALOR **R$ 2,77** = **R$ 26,00**, acompanhada da observação vermelha.
- O total esperado da auditoria permanece **R$ 71,62**.

## Detalhes técnicos
- Ajustar `calcularEsperado` em `src/lib/cte-audit.server.ts` para gerar uma única linha FRETE PESO quando o mínimo for aplicado, preservando no critério o valor calculado antes do mínimo e o valor mínimo.
- Ajustar a grade em `src/components/ctes/CteDetailView.tsx` para reconhecer o novo critério e consolidar auditorias antigas que ainda tenham a linha AJUSTE FRETE MÍNIMO.
- A observação usará a cor semântica de erro já adotada pelo sistema.
- Atualizar `src/config/version.ts` e `CHANGELOG.md`.

## Riscos e impacto
- **Banco compartilhado:** nenhum; sem migração e sem regravação de auditorias históricas.
- **Cálculos:** o total esperado, a diferença e o resultado da auditoria não mudam; apenas a distribuição visual entre as linhas.
- **Integrações e flags:** nenhuma alteração.

## Validação
- Conferir o CT-e do exemplo: não deve existir a linha AJUSTE FRETE MÍNIMO; FRETE PESO deve mostrar R$ 23,23 e a observação vermelha sobre o mínimo de R$ 26,00 e o calculado de R$ 11,12.
- Confirmar que FRETE PESO + FRETE VALOR continua totalizando R$ 26,00 e que o total geral permanece R$ 71,62.
- Conferir um CT-e sem aplicação de mínimo: ele deve permanecer inalterado e sem observação.

## Checklist para publicar
- Testar no preview um CT-e com frete mínimo e outro sem frete mínimo.
- Migrações aplicadas: nenhuma.
- Flags para ligar após publicar: nenhuma.
- Reversão: retornar à versão 1.41.0 pelo histórico do Lovable; não há SQL de reversão.
