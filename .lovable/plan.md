# Rota 437: por que 3 entregas estão sem localização, e como corrigir

## O que encontrei nos dados
- Os 5 pedidos da rota não têm endereço nem coordenada própria vindos do ERP.
- Nesse caso, o app usa a localização salva do cliente. Só os clientes 136441 (Mundo dos Cosméticos) e 235890 (Dima) têm localização salva.
- Os clientes 60658 (Supermercado da Família), 187801 (Isaac Vasconcelos) e 185167 (Coml. Novo Carmelo) nunca foram localizados.
- O motivo: a busca automática de localização no sync só usa o endereço do pedido, que vem vazio. Além disso, ela processa só 30 clientes por rodada. Por isso, clientes novos ficam sem localização.
- A tela "Pedidos sem rota" já resolve isso com uma aproximação por bairro/cidade, com o selo "≈ bairro". A tela da rota não usa essa aproximação.

## O que muda
1. **Detalhe da rota:** quando o cliente não tiver localização, usar o bairro/cidade do pedido no ERP (aqui: Camaragibe, Centro / Timbi / Novo Carmelo). O ponto aparece no mapa com o selo "≈ bairro" ou "≈ cidade", igual à tela "Pedidos sem rota". "Endereço não localizado" fica só para quando nem isso existir.
2. **Sync:** a busca de localização passa a montar o endereço com logradouro, bairro, cidade e UF do cadastro do cliente no ERP, em vez de só o endereço do pedido. Também passa a priorizar clientes que estão em rotas e pedidos abertos. Assim, esses clientes passam a ter localização exata.
- Versão 1.15.4 (PATCH), com changelog. Sem mudança na estrutura do banco.

## Detalhes técnicos
- `rotas.$routeId.tsx`: em `RouteMapSection`, para pedidos sem coordenadas, usar `uf/cidade/bairro` de `listarPedidosDetalheRota` e chamar `localizarLocalidades`, que já tem cache e filtro de pontos discrepantes. Usar `coordSource` como `bairro`/`cidade`, com selo e marcador diferenciado.
- `erp-sync.server.ts` (geocodificação): buscar o endereço do cliente na view ERP de clientes já usada pelo detalhe. Ignorar consulta vazia (hoje vira só "Brasil"). Ordenar os pendentes por pedidos em rota.

## Checklist para publicar
- Abrir a rota 437: as 5 entregas devem aparecer no mapa, e as 3 aproximadas devem ter o selo "≈ bairro".
- Depois do próximo sync, conferir se os 3 clientes passam a ter localização exata.
- Reverter: restaurar a versão anterior. A localização salva pode ser mantida.
