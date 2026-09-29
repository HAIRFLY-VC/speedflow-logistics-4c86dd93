# Status sem quebra, código da rota sem "ID" e colunas reequilibradas (v1.7.3 - PATCH)

## O que muda
1. **"Pedidos por status" sem quebra**: cada status (ex.: "09-CONFERIDO") fica sempre em uma linha. A coluna ganha largura fixa maior (de 140px para ~190px na tela de Autorizar e mínimo equivalente nas demais telas), e o texto é impedido de quebrar mesmo quando a tabela aperta.
2. **Tirar "ID" antes do código da rota** em todas as telas: listagens de rotas (Rotas Pendentes, Autorizar pagamento etc.) e o título do modal de pagamento passam a mostrar só o número (ex.: "419" em vez de "ID 419").
3. **Coluna ID mais estreita**: de 58px para ~40px, e o espaço vai para "Pedidos por status".

## Detalhes técnicos
- `RotasView.tsx`: render da coluna `erp_route_id` sem prefixo, width `40px`; `pedidos_status` width `190px` (autorização) / `min-width` nas demais; `StatusList` com `min-w-max` e `shrink-0` nos rótulos, além de `whitespace-nowrap` para impedir quebra por palavra.
- Título do modal de pagamento (linha ~1902): remover "ID ".
- Rótulo "ID da rota no ERP:" no editor de rota fica (é um rótulo descritivo, não prefixo do código).
- `version.ts` para 1.7.3 e entrada no CHANGELOG. Sem banco nem integrações afetadas.

## Checklist para publicar
- Conferir no preview as telas Autorizar pagamento e Rotas Pendentes: status em uma linha, código sem "ID".
- Sem migrações; sem flags novas. Reverter pelo histórico do Lovable.
