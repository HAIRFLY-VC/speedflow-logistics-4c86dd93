# Painel Custo de Frete: botão Voltar e dados que não aparecem (PATCH v1.29.1)

## 1. Botão "Voltar"
- Hoje o botão geral só aparece quando o app registrou uma tela anterior. Se a tela for aberta direto ou a página for recarregada, ele some.
- O painel passa a ter sempre "Voltar", acima do título:
  - volta para a tela que abriu o painel (ex.: Rotas Pendentes, pelo card), mantendo os filtros;
  - se não houver tela anterior, vai para Rotas Pendentes.

## 2. Dados não exibidos ("Não foi possível carregar os dados de frete")
O que já foi conferido: a busca das notas faturadas do ciclo responde normalmente. A falha acontece numa das buscas seguintes (pedidos → rotas → clientes → fretistas). A causa exata ainda não foi confirmada.
- Primeiro passo: abrir o painel no preview e capturar o erro real de cada busca.
- Causas prováveis, a confirmar: listas de códigos longas demais no endereço da busca (lotes de 200), ou um campo/relação com nome diferente no banco central.
- Correção conforme a causa: lotes menores e/ou ajuste dos campos. Também passa a mostrar o motivo do erro na tela, em vez da mensagem genérica.
- A mesma correção vale para o card "% Frete do ciclo" e para o gráfico de evolução, que usam a mesma leitura.

## Riscos
Somente leitura e navegação. Sem migração e sem gravação no ERP.

## Detalhes técnicos
- `custo-frete.tsx`: `<BackButton fallbackTo="/rotas" fallbackLabel="Rotas Pendentes" />`; incluir `/custo-frete` na exceção do botão geral do `AppShell` para não duplicar.
- `custo-frete.query.ts`: reproduzir via Playwright, identificar a consulta que falha e corrigir (`LOTE` menor e/ou select corrigido); propagar `error.message`.
- `version.ts` 1.29.1 e CHANGELOG.

## Checklist para publicar
- Abrir pelo card e pelo menu; conferir Voltar e os números do ciclo atual.
- Recarregar a página e conferir o Voltar para Rotas Pendentes.
- Reverter: v1.29.0 no histórico.
