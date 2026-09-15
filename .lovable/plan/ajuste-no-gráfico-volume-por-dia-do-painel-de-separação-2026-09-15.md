# Ajuste no gráfico "Volume por dia" do painel de Separação

## Objetivo
Alterar o gráfico de barras "Volume por dia" para usar dois eixos Y distintos e barras com cores diferentes.

## Alterações
1. **Dois eixos Y no `<BarChart>`:**
   - Eixo esquerdo (`orientation="left"`, `yAxisId="caixas"`) para a quantidade de caixas.
   - Eixo direito (`orientation="right"`, `yAxisId="pedidos"`) para a quantidade de pedidos.
2. **Associar cada `<Bar>` ao seu eixo:**
   - `Bar dataKey="caixas"` → `yAxisId="caixas"`.
   - `Bar dataKey="pedidos"` → `yAxisId="pedidos"`.
3. **Cores distintas:** manter as duas barras em cores semanticamente diferentes (caixas e pedidos), ajustando se necessário para garantir contraste visual com os dois eixos.
4. **Tooltip:** garantir que o tooltip do Recharts continue exibindo os valores corretamente com as duas séries.

## Arquivo afetado
- `src/routes/_authenticated/separacao.tsx` (trecho do gráfico "Volume por dia").

## Validação
- Typecheck com `bunx tsgo --noEmit`.
- Build OK.
- Verificação visual no preview do painel `/separacao`.
