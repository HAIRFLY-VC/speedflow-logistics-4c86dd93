# Card "Pedidos pendentes sem rota" na mesma linha dos indicadores

## O que muda

Tela **Rotas Pendentes** (`src/components/routes/RotasView.tsx`):

1. **Posição**: o card sai da linha própria acima dos indicadores e passa a integrar a MESMA linha (grade) dos 4 cards existentes — Valor das mercadorias, Peso total, Pedidos, Entregas — ocupando a última posição, à direita.

2. **Exibição condicional**: o card só aparece quando `resumoSemRota.pedidos > 0` (com o link e o fundo pulsando em vermelho claro, como já funciona). Sem pendências, ele desaparece e os 4 cards voltam a preencher a linha sozinhos.

3. **Layout da grade**:
   - Desktop (lg): `grid-cols-5` quando o card existe; `grid-cols-4` quando não existe.
   - Mobile/tablet: mantém 2 colunas; o card ocupa a linha inteira (col-span-2) e os 4 totais continuam em 2x2 dentro dele.
   - Dentro do card na linha (largura reduzida), os totais (Mercadorias, Peso, Pedidos, Entregas) passam a empilhar em uma única coluna para não quebrar valores.

## Fora de escopo

- Nenhuma mudança de dados, consulta, banco ou feature flag (`cardPedidosSemRota` continua igual).
- Tela "Autorizar pagamento de frete" não é afetada (o card nunca aparece lá).

## Versão

- PATCH → `1.8.1`, com entrada no `CHANGELOG.md`.

## Validação

- Typecheck/build.
- Playwright na tela Rotas Pendentes: com pendências, card na mesma linha à direita com fundo pulsando; clicando leva a "Pedidos sem rota".
