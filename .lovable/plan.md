# Corrigir detalhamento de Mercadorias faturadas vazio (PATCH v1.33.1)

## Causa
A tela mostra o erro "(o.route_orders ?? []).map is not a function": o vínculo pedido → rota às vezes chega como um único registro em vez de lista, e a leitura quebrava, impedindo a exibição de todas as notas.

## Correção
- Tratar o vínculo pedido → rota nos dois formatos (lista ou registro único), como já é feito no painel Custo de Frete.
- Se mesmo assim a busca da rota falhar, as notas continuam aparecendo (só a coluna ID ROTA fica vazia).

## Riscos
Somente leitura. Sem migração, sem gravação no ERP.

## Detalhes técnicos
- `src/lib/custo-frete.query.ts` → `carregarMercadorias`: normalizar `route_orders` com `Array.isArray(...) ? ... : x ? [x] : []` (mesma lógica de `rosDe`).
- `version.ts` 1.33.1 e CHANGELOG.

## Checklist para publicar
- Abrir pelo card, conferir notas listadas e total de Valor igual ao card.
- Reverter: v1.33.0 no histórico.
