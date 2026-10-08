# Vínculo de uma tabela de frete a várias transportadoras

## Situação atual
A funcionalidade já existe no cadastro: ao editar uma tabela em "Tabelas de frete", a seção "Transportadoras que utilizam esta tabela" permite marcar várias transportadoras, e o cálculo de frete (auditoria de CT-e e provisionamento) já considera esses vínculos. O que falta é visibilidade: na listagem, cada tabela mostra apenas a transportadora principal, sem indicar as demais vinculadas.

## O que muda (classificação: PATCH)

1. **Listagem de Tabelas de frete:** exibir, em cada linha, todas as transportadoras vinculadas à tabela (principal + adicionais), em formato compacto (selos com o nome, ou "Principal + N" com popup listando todas).
2. **Confirmação do vínculo no cálculo:** garantir que a tela de provisionamento de frete e a auditoria de CT-e usem a tabela compartilhada para qualquer transportadora vinculada (verificação de código, sem mudança de regra).
3. **Regra mantida:** uma transportadora continua podendo ter apenas uma tabela vigente por período — essa proteção contra cálculo duplicado não será removida.

## Riscos
- Nenhum para o banco de dados: nenhuma migração nova (a estrutura N:N já existe desde agosto).
- Nenhum para a versão publicada: mudança apenas visual na listagem.

## Detalhes técnicos
- Arquivo principal: `src/routes/_authenticated/tabelas-frete.tsx` (listagem passa a consultar `tabelas_preco_frete_transportadoras` e exibir os vínculos).
- Verificação em `src/lib/frete-simulacao.ts` (`tabelaVigenteDaTransportadora` já considera o vínculo N:N) e `src/lib/provisao-frete.server.ts`.
- Versão 1.24.2 + entrada no CHANGELOG.md.

## Checklist para publicar
- No preview, abrir "Tabelas de frete" e conferir que a tabela da SOLUTION mostra todas as transportadoras vinculadas.
- Editar uma tabela, marcar/desmarcar uma transportadora e confirmar que a listagem reflete a mudança.
- Nenhuma migração de banco necessária.
- Reverter: versão anterior no histórico do Lovable.
