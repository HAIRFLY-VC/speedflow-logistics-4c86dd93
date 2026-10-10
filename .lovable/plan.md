# Frete mínimo só sobre o Frete Peso no detalhamento da rota

## Problema
No detalhamento de frete da rota (ex.: NF 65688, CABRAL — CARUARU/PE), o frete mínimo da tabela (R$ 26,00) está sendo comparado com a soma Frete Peso + Frete Valor (R$ 13,81) e substituindo as duas parcelas. A regra correta — a mesma já aplicada na auditoria de CT-e (v1.41.1) — é: **o frete mínimo se aplica somente ao Frete Peso**; o Frete Valor permanece independente.

Hoje: base = 26,00 (mínimo) + 35,00 (despacho) = 61,00.
Correto: Frete Peso = max(11,04; 26,00) = **26,00**; Frete Valor = **2,77**; base = 26,00 + 2,77 + 35,00 = **63,77**; total da entrega passa de 71,62 para **74,39**.

## Classificação
PATCH (correção de cálculo, sem mudança de estrutura) → **v1.41.2**.

## Mudanças

1. **`src/lib/frete-simulacao.ts`** (`detalharEntrega`):
   - Método por praça: aplicar o mínimo apenas ao Frete Peso — `frete_peso = max(frete_peso_calculado, frete_minimo)`; manter `frete_valor` separado; `frete_base = frete_peso_final + frete_valor + taxa_despacho`. Guardar o valor calculado original para a observação.
   - Método por faixa de peso: mesma regra — mínimo compara só com o Frete Peso da faixa (valor fixo da faixa permanece fora da comparação).
   - Método por percentual de valor (sem componente de peso): manter comportamento atual (mínimo sobre o valor calculado), pois não há Frete Peso.
   - `minimo_aplicado` passa a indicar que o mínimo elevou o Frete Peso.

2. **`src/components/routes/ProvisaoFreteDialog.tsx`** (tela do anexo):
   - Linha **Frete Peso** exibe o valor final (ex.: R$ 26,00) com observação em vermelho: "frete mínimo de R$ 26,00 aplicado (calculado R$ 11,04)" — mesmo padrão visual da tela de detalhamento de CT-e.
   - Remover a linha separada "Frete mínimo"; "Frete calculado" e "Frete base" refletem os novos valores.

3. **Consistência**: `src/lib/provisao-frete.server.ts` usa o mesmo motor, então as provisões de frete passam a seguir a mesma regra automaticamente.

4. **Versão/changelog**: `src/config/version.ts` → 1.41.2; entrada no topo do `CHANGELOG.md`.

## Validação
- `bunx tsgo --noEmit`.
- Conferir no preview o exemplo do anexo: Frete Peso 26,00 com aviso vermelho, Frete Valor 2,77, Frete base 63,77, Total 74,39.
- Conferir uma entrega cujo frete calculado supere o mínimo (nada muda, sem aviso).

## Riscos e banco
- Nenhuma migração; nenhuma gravação no banco compartilhado. Apenas cálculo/exibição.
- Valores de provisão já gravados no ERP não são alterados retroativamente; novas simulações/provisões seguem a regra corrigida.

## Reversão
Voltar para a versão 1.41.1 no histórico do Lovable.
