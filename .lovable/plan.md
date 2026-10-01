# Rota 437: mostrar todas as entregas na lista abaixo do mapa

## Causa provável
A lista abaixo do mapa ("Mapa e sequência da rota") só é montada com pedidos que têm localização (coordenada do pedido ou do cliente). Pedidos sem localização são descartados da lista e do mapa — por isso aparecem 2 de 5. O primeiro passo será confirmar isso nos dados da rota 437.

## O que muda
- O mapa continua mostrando só as entregas localizadas.
- A lista passa a mostrar **todas** as entregas da rota:
  - primeiro as localizadas, na sequência do mapa (1, 2, ...);
  - depois as não localizadas, em um grupo "Sem localização no mapa", com selo âmbar "Endereço não localizado" e o endereço disponível.
- Se nenhuma entrega tiver localização, o cartão aparece mesmo assim, sem o mapa, com a lista completa.
- Versão 1.15.3 (PATCH) e entrada no changelog. Sem mudança no banco.

## Detalhes técnicos
- `src/routes/_authenticated/rotas.$routeId.tsx` → `RouteMapSection`: separar `stops` em localizados (vão para `SuggestionMap`/`sequenceStops`) e não localizados; passar ambos ao `PedidosDaRotaTabela` (coordSource `"none"` para os sem localização); não retornar `null` quando `mapStops` estiver vazio, só ocultar o mapa.
- Validar consultando os pedidos da rota 437 e conferindo coordenadas.
- Atualizar `src/config/version.ts` e `CHANGELOG.md`.

## Checklist para publicar
- No teste, abrir a rota 437 e conferir 5 entregas na lista.
- Reverter: restaurar a versão anterior no histórico.
