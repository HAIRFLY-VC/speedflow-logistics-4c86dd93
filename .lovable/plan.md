# Frete mínimo na linha FRETE PESO

## Classificação
**PATCH — v1.41.1.** Correção da regra e da apresentação do frete mínimo na auditoria do CT-e.

## O que será alterado
- Quando o mínimo da praça for aplicado, remover da grade a linha separada **AJUSTE FRETE MÍNIMO**.
- Incorporar esse ajuste à linha **FRETE PESO**: quando o valor calculado pelo peso for inferior ao mínimo, o valor esperado de **FRETE PESO** será exatamente o frete mínimo.
- **FRETE VALOR não participa da comparação nem da composição do frete mínimo** e continua sendo somado separadamente.
- Abaixo do valor de **FRETE PESO**, exibir em vermelho: **“Foi cobrado o frete mínimo de R$ X,XX em vez do valor calculado de R$ Y,YY.”**
- Manter normalmente as demais linhas, a comparação com o valor cobrado e os totais.
- Auditorias novas e reauditorias passarão a usar a regra corrigida; registros antigos permanecem preservados até o usuário executar **Reauditar**.

## Exemplo do caso enviado
- Cálculo original: FRETE PESO **R$ 11,12** + FRETE VALOR **R$ 2,77**.
- Frete mínimo: **R$ 26,00**.
- Nova apresentação: FRETE PESO **R$ 26,00**, acompanhado da observação vermelha, mais FRETE VALOR **R$ 2,77** em sua linha própria.
- O total esperado do exemplo passa de **R$ 71,62** para **R$ 74,39**, pois a regra anterior descontava incorretamente o FRETE VALOR do mínimo de FRETE PESO.

## Detalhes técnicos
- Ajustar `calcularEsperado` em `src/lib/cte-audit.server.ts` para comparar apenas o FRETE PESO calculado com o mínimo e gerar uma única linha FRETE PESO, preservando no critério o valor calculado antes do mínimo e o valor mínimo.
- Ajustar a grade em `src/components/ctes/CteDetailView.tsx` para reconhecer o novo critério e exibir a observação em vermelho.
- A observação usará a cor semântica de erro já adotada pelo sistema.
- Atualizar `src/config/version.ts` e `CHANGELOG.md`.

## Riscos e impacto
- **Banco compartilhado:** nenhum; sem migração e sem regravação de auditorias históricas.
- **Cálculos:** o total esperado, a diferença e eventualmente o resultado da auditoria podem mudar, pois FRETE VALOR deixará de reduzir indevidamente o mínimo de FRETE PESO.
- **Histórico:** nenhuma auditoria antiga será regravada automaticamente; é necessário reauditar o CT-e para aplicar a regra corrigida.
- **Integrações e flags:** nenhuma alteração.

## Validação
- Reauditar o CT-e do exemplo: não deve existir a linha AJUSTE FRETE MÍNIMO; FRETE PESO deve mostrar R$ 26,00 e a observação vermelha sobre o mínimo de R$ 26,00 e o calculado de R$ 11,12.
- Confirmar que FRETE VALOR permanece separado em R$ 2,77 e que o total geral passa a R$ 74,39.
- Conferir um CT-e sem aplicação de mínimo: ele deve permanecer inalterado e sem observação.

## Checklist para publicar
- Testar no preview um CT-e com frete mínimo e outro sem frete mínimo.
- Migrações aplicadas: nenhuma.
- Flags para ligar após publicar: nenhuma.
- Reversão: retornar à versão 1.41.0 pelo histórico do Lovable; não há SQL de reversão.
