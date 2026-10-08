# Provisionamento: notas agrupadas por entrega e memória de cálculo detalhada

Classificação: MINOR (v1.25.0). Muda o valor provisionado: o frete passa a ser calculado uma vez por entrega (mínimo, despacho e TAS deixam de ser cobrados em cada nota).

## O que muda para o usuário
- No modal "Provisionar frete da transportadora", as notas aparecem agrupadas por entrega (mesmo cliente + cidade/UF), com uma linha de total da entrega (peso, mercadoria, frete) e as notas logo abaixo.
- Cada entrega pode ser expandida para mostrar a composição do frete, passo a passo:
  - Praça encontrada na tabela (origem → destino) ou faixa de peso / % sobre valor usada
  - Peso real x peso mínimo → peso cobrado; tarifa por kg → frete peso
  - Frete valor (% x mercadoria)
  - Frete mínimo aplicado (sim/não)
  - Taxa de despacho, GRIS (% e mínimo), Ad valorem, TAS
  - Subtotal, ICMS (% e valor "por dentro"), total da entrega
- Nas notas, o frete mostrado é o rateio do total da entrega proporcional ao peso (diferença de centavos ajustada na última nota).
- Nova coluna "% Frete" (frete / mercadoria) em cada nota e em cada entrega.
- Rodapé: total de mercadorias, total provisionado e % do frete da rota, além de resumo somado por componente (frete peso, GRIS, ICMS etc.).

## Gravação no ERP
- Continua uma linha por nota em A_GER_PROVISAO_FRETE, com o valor rateado.
- A memória de cálculo (CLOB) passa a guardar o detalhamento por entrega e o critério de rateio, para comparação posterior com o CT-e.

## Riscos
- Sem migração. Valores provisionados de rotas novas tendem a ser menores que antes (mínimos não se repetem). Rotas já gravadas não são recalculadas.

## Detalhes técnicos
- `src/lib/frete-simulacao.ts`: nova `detalharEntrega()` que retorna os componentes; `simularEntrega()` passa a usá-la (comportamento atual preservado para outras telas).
- `src/lib/provisao-frete.types.ts`: tipos `ProvisaoEntrega` (chave, cliente, cidade/UF, totais, `componentes`, `notas[]`).
- `src/lib/provisao-frete.server.ts`: agrupar notas por cliente+cidade+UF, calcular por entrega, ratear por peso, incluir detalhamento na memória JSON.
- `src/components/routes/ProvisaoFreteDialog.tsx`: tabela agrupada com linha totalizadora e painel expansível de composição.
- Atualizar `src/config/version.ts` e `CHANGELOG.md`.

## Checklist para publicar
- Testar rota 453 no preview: 2 entregas, conferir componentes e soma do rateio.
- Nenhuma migração; nenhuma flag nova.
- Reverter: voltar à versão 1.24.5 no histórico.
