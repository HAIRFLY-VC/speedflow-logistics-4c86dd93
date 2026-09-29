# Exibir % do frete no modal de pagamento

## Objetivo
No modal "Confirmar pagamento" (tela Autorizar pagamento de frete), exibir o percentual do frete sobre o valor da mercadoria, posicionado entre "Mercadoria: R$ ..." e "N pedido(s)".

## Mudança
Em `src/components/routes/PagamentoRotaDialog.tsx` (resumo do preview, ~linha 453-461):

- Calcular `percFrete = valor_mercadoria > 0 ? (valor / valor_mercadoria) * 100 : null`.
- Exibir novo item no resumo: `Frete: X,XX%` (2 casas decimais, formato brasileiro), entre "Mercadoria" e "pedido(s)".
- Se o valor da mercadoria for zero ou o frete ainda não informado (0), exibir `—` em vez do percentual.
- Reutilizar o valor total a pagar já exibido (`p.valor`, que inclui adicionais quando houver), mantendo consistência com a coluna "% Frete" da listagem.

Exemplo visual do resumo após a mudança:

```text
Valor a pagar: R$ 1.300,00   Mercadoria: R$ 17.572,47   Frete: 7,40%   13 pedido(s)
```

## Verificação
- Typecheck/build.
- Conferência visual com Playwright no modal de uma rota com valor informado.
