# Adicionar quantidade de entregas no totalizador do rodapé

## Contexto
Na tela **Pedidos sem rota**, o usuário seleciona pedidos agrupados por cliente. Cada cliente representa uma entrega. O rodapé já mostra a quantidade de pedidos, peso e valor selecionados, mas falta a quantidade de entregas.

## O que será feito
1. Calcular, a partir dos pedidos selecionados, quantos códigos/clientes distintos estão presentes (contagem de entregas).
2. Exibir essa informação no totalizador fixo do rodapé, ao lado da quantidade de pedidos, sem quebrar o layout compacto para celular.

## Arquivo envolvido
- `src/routes/_authenticated/pedidos-sem-rota.tsx` (memo `resumoSelecao` e JSX do rodapé).

## Critério de aceite
- Rodapé mostra: **X pedido(s) · Y entrega(s)** + valor + peso.
- Nenhuma outra funcionalidade muda.
