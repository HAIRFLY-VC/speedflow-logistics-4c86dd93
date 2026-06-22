## Objetivo

Quando o ERP enviar, no campo `OBS_LOGIST` de um pedido, um texto no formato:

```
ENDERECO DE ENTREGA: <endereço alternativo>
```

o app deve usar o `<endereço alternativo>` (após os `:`) como ponto de entrega daquele pedido para fins de roteirização e exibição no mapa, **substituindo** a latitude/longitude do cliente apenas para esse pedido. O endereço do cliente original permanece intocado (outros pedidos do mesmo cliente continuam usando o endereço de cadastro).

Caso o ERP envie um pedido para Fernando de Noronha (cliente `131687 — NORONHAO`) com `OBS_LOGIST = "ENDERECO DE ENTREGA: Rua X, Recife/PE"`, a parada passa a ser geocodificada em Recife e a rota terrestre volta a ser calculada.

## Mudanças

### 1. Banco (`orders`)
Adicionar 3 colunas opcionais (migração):
- `delivery_address text` — endereço extraído do OBS_LOGIST
- `delivery_latitude numeric`
- `delivery_longitude numeric`

Sem alteração de RLS/GRANTs (já cobertos pela política existente da tabela).

### 2. Sincronização ERP (`src/lib/erp-sync.server.ts`)
- Criar helper `parseDeliveryOverride(obsLogist)` com regex `^\s*ENDERECO\s+DE\s+ENTREGA\s*:\s*(.+)$` (case-insensitive, multiline). Retorna o texto após `:` ou `null`.
- No `processRow`, ao montar o payload de `orders`:
  - Calcular `deliveryAddress = parseDeliveryOverride(row.OBS_LOGIST)`.
  - No `INSERT`: gravar `delivery_address` (lat/lng ficam `null`, serão geocodificados a seguir).
  - No `UPDATE`: se `deliveryAddress` mudou em relação ao registro atual, gravar o novo endereço e **zerar** `delivery_latitude`/`delivery_longitude` para forçar re-geocodificação. Se ficou `null`, limpar também as coordenadas.
- Após o loop principal, no bloco que hoje geocodifica `customers` sem lat/lng, adicionar um segundo passo análogo: buscar `orders` com `delivery_address IS NOT NULL AND delivery_latitude IS NULL`, geocodificar via gateway Google Maps e gravar `delivery_latitude/longitude` no pedido. Contador `geocoded_orders` retornado no relatório de sync (junto com `geocoded_customers`).

### 3. Helper de coordenadas
Criar `src/lib/order-coords.ts` (utilitário client-safe):

```ts
export type CoordSource = { lat: number; lng: number; source: "order" | "customer" };
export function getOrderCoord(order: {
  delivery_latitude?: number | string | null;
  delivery_longitude?: number | string | null;
  customers?: { latitude?: number | string | null; longitude?: number | string | null } | null;
}): CoordSource | null { /* prioriza delivery_*, fallback customers.* */ }
```

### 4. Consumidores das coordenadas
Atualizar `select(...)` para incluir `delivery_address, delivery_latitude, delivery_longitude` e trocar acessos diretos por `getOrderCoord(o)` em:
- `src/lib/route-suggestions.functions.ts` (clustering + suggestion + tela de rotas existentes)
- `src/routes/_authenticated/sugestao-rotas.tsx` (filtro `noCoord`, contagem pendente, geocode-aviso)
- `src/routes/_authenticated/rotas.index.tsx` (mapa + auto-recalc de distância)
- `src/routes/_authenticated/rotas.$routeId.tsx` (mapa de detalhamento)

A UI das paradas pode opcionalmente mostrar um badge "endereço alternativo" quando `source === "order"" — incluído apenas na tela de detalhe da rota, com tooltip exibindo o `delivery_address`.

### 5. Recalculo
Como `delivery_latitude/longitude` entram nas mesmas funções de cálculo, o auto-recalc de distância (já existente) cobre o caso. Pedidos que ainda não foram geocodificados após o sync ficam com a fallback do cliente — sem regressão.

## Não escopo
- Sem mudanças no fluxo de aprovação, faturamento ou status do pedido.
- O endereço do cadastro do cliente (Noronha) permanece como está; apenas a parada do pedido específico muda.
- Sem nova tela de edição manual do endereço alternativo (ele vem sempre do ERP).
