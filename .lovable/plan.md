# Ajustar mensagem "Aguardando faturamento"

## Objetivo
Na tela **Rotas Pendentes**, quando o botão "Confirmar Pgto" está desabilitado por falta de faturamento, a mensagem deve exibir apenas a quantidade de pedidos que ainda faltam ser faturados (ex: "Aguardando faturamento de 10 pedidos").

## Alterações
1. Em `src/routes/_authenticated/rotas.index.tsx`, localizar o texto atual "Aguardando faturamento de X de Y pedidos".
2. Substituir por uma mensagem que mostre apenas o número pendente: `Aguardando faturamento de ${pendentes} pedido${pendentes === 1 ? '' : 's'}`.
3. Reaproveitar a variável `pendentes` já calculada (`bordero.total - bordero.faturados`).

## Fora do escopo
- Nenhuma alteração de banco de dados.
- Nenhuma mudança na regra de habilitação do botão.
- Nenhuma alteração no fluxo de confirmação de pagamento.
