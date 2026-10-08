# Corrigir botão "Voltar" que não responde (PATCH v1.24.3)

## Causa provável
O botão usa o "voltar" do navegador. Na tela da rota, o endereço é atualizado mais de uma vez na mesma tela (ex.: parâmetro `?from=autorizar`), criando entradas extras no histórico. O clique volta para a mesma tela da rota, parecendo que nada aconteceu.

## Correção
- O botão "Voltar" passa a ir direto para a tela anterior registrada (ex.: Autorizar pagamento de frete), mantendo filtros salvos, em vez de depender do histórico do navegador.
- O registro das telas visitadas passa a guardar o endereço completo (com filtros) e ignorar atualizações que ficam na mesma tela.
- Vale para todas as telas que mostram "Voltar".

## Detalhes técnicos
- `BackButton.tsx`: pilha guarda `pathname + searchStr`; mudanças com mesmo pathname substituem o topo em vez de empilhar. Clique: `router.navigate({ href: prev })` e remove o topo da pilha.
- Validar no preview: Autorizar → rota → Voltar retorna à lista.
- `version.ts` 1.24.3 e CHANGELOG. Sem banco nem integrações.

## Checklist para publicar
- Testar Voltar a partir de rota, pedido, CT-e e Pedidos sem rota.
- Reverter: v1.24.2 no histórico.
