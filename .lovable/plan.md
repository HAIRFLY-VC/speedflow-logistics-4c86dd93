# Quantidade de entregas da rota 422

## O que foi verificado
- A coluna "Qtd Entregas" conta **1 entrega por cliente diferente** da rota.
- No ERP, a rota 422 tem 25 pedidos com nota para **17 clientes diferentes**, ou seja, o 17 bate com o ERP pela regra atual.
- O 26º pedido (4135456) está na rota, mas não tem nota nem cliente em entregas, por isso não entra na contagem.

## Proposta (PATCH v1.5.2)
1. Contar entregas pelo código do cliente no ERP (mais confiável que o cadastro local), para que pedidos importados pela conferência nunca fiquem de fora.
2. Mostrar ao passar o mouse na coluna: "17 clientes · 25 pedidos · 1 pedido sem nota", para deixar claro de onde vem o número.

Se a regra desejada for outra (1 por pedido, 1 por nota fiscal ou 1 por endereço), me diga ao rejeitar o plano que eu ajusto.

## Detalhes técnicos
- `src/components/routes/RotasView.tsx` `paradasOf`: usar `orders.erp_cod_cliente` com fallback em `customer_id`; tooltip com contagens.
- Sem migração; atualizar `version.ts` e `CHANGELOG.md`.
