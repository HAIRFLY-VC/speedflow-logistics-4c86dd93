## Objetivo

Criar uma funcionalidade que identifica pedidos com `DT_PREV_EXP = 01/01/4000` (pedidos sem roteirização planejada) e sugere automaticamente, com auxílio do Google Maps, como roteirizá-los — seja encaixando em rotas já planejadas, seja propondo rotas novas. O usuário revisa, ajusta e confirma.

## Pré-requisitos

1. **Conectar o connector Google Maps Platform** (gateway gerenciado pela Lovable). Será solicitado ao iniciar a implementação.
2. **Geocodificação dos clientes** — hoje `customers.latitude / longitude` estão nulos. Sem isso nada de cluster ou roteamento funciona.

## Nova tela: `/sugestao-rotas`

Acessível pelo menu lateral (`AppShell`). Layout em 3 painéis:

```text
┌───────────────────────────────────────────────────────────────┐
│ Topo:  [Gerar sugestões]  [Geocodificar clientes pendentes]   │
├───────────────────┬───────────────────────────────────────────┤
│ Pedidos sem rota  │  Sugestões geradas                        │
│ (lista filtrável) │  ┌─────────────────────────────────────┐  │
│ - Nº pedido       │  │ Sugestão 1 — Rota NOVA "Zona Norte" │  │
│ - Cliente         │  │   Data: 24/06   Peso 1.2t / 70%     │  │
│ - Cidade/UF       │  │   3 pedidos · valor R$ 18.420       │  │
│ - Peso / Valor    │  │   [Mapa]   [Editar]   [Confirmar]   │  │
│ - "não geocodif." │  ├─────────────────────────────────────┤  │
│   badge se faltar │  │ Sugestão 2 — Encaixar em rota       │  │
│   lat/lng         │  │   "Centro 24/06" (já existente)     │  │
│                   │  │   +1 pedido · +120 kg               │  │
│                   │  │   [Mapa]   [Editar]   [Confirmar]   │  │
│                   │  └─────────────────────────────────────┘  │
└───────────────────┴───────────────────────────────────────────┘
```

### Fluxo

1. Ao abrir, lista os pedidos com `dt_prev_exp = '4000-01-01'`.
2. Botão **Geocodificar clientes pendentes** dispara server function que percorre os clientes envolvidos sem lat/lng e chama o Geocoding API (via gateway) usando `address_line, city, state, zip_code`. Resultado salvo em `customers.latitude/longitude`. Mostra progresso.
3. Botão **Gerar sugestões** chama server function `suggestRoutes` que:
   - Carrega pedidos sem rota + dados do cliente (lat/lng, peso, valor).
   - Carrega rotas planejadas futuras (`status = planejada`, data ≥ hoje) com seus pedidos/paradas.
   - **Tenta encaixe em rota existente**: para cada pedido, calcula desvio em km (Distance Matrix) entre o pedido e as paradas da rota; se < raio configurável (ex: 30 km) e há capacidade (peso/valor) → sugere encaixe.
   - **Para o restante**, agrupa por proximidade (clustering simples por cidade/UF + raio), respeita capacidade máx por veículo (configurável em `company_settings`) e sugere nova rota com data próximo dia útil.
   - Para cada cluster final, chama Routes API (`computeRoutes` com `optimizeWaypointOrder=true`) a partir de um depósito configurado para obter ordem ótima das paradas, distância e tempo estimados.
   - Retorna lista de sugestões com tipo (`new_route` | `append_existing`), pedidos, rota alvo, métricas (peso, valor, distância, tempo, % capacidade) e ordem sugerida das paradas.
4. Cada card de sugestão mostra:
   - Tipo, data, métricas, pedidos com cliente/cidade.
   - **Mapa** (Maps JavaScript API) com marcadores e a polyline da rota.
   - Ações: **Confirmar** (cria/atualiza rota e vincula `route_orders`, atualiza `orders.dt_prev_exp` para a data da rota), **Editar** (drawer para mudar data, motorista, remover pedidos / mover pedido entre sugestões), **Descartar**.
5. **Aceitar todas** no topo aplica em lote as sugestões marcadas.
6. Ao confirmar, pedidos saem da lista de "sem rota" e a sugestão some.

## Backend

### Configurações novas em `company_settings`

- `depot_address` (text) — endereço do depósito (origem das rotas).
- `depot_latitude`, `depot_longitude` (numeric) — preenchidos via geocoding.
- `max_route_weight_kg` (numeric, default 5000).
- `max_route_value_brl` (numeric, default 0 = sem limite).
- `route_cluster_radius_km` (numeric, default 30).

UI para editar na tela **Configurações**.

### Server functions (em `src/lib/route-suggestions.functions.ts`)

- `geocodePendingCustomers()` — autenticada; itera clientes sem lat/lng vinculados a pedidos sem rota; chama gateway `/maps/api/geocode/json`; faz `update` em `customers`. Retorna contadores.
- `suggestRoutes()` — autenticada; executa a lógica de cluster + Distance Matrix + Routes API. Retorna sugestões (não persiste). Cache em memória curta por chamada para reaproveitar Distance Matrix.
- `confirmRouteSuggestion({ suggestion })` — autenticada; numa transação cria `routes` (quando `new_route`) ou usa rota existente, insere `route_orders` na ordem otimizada, atualiza `orders.dt_prev_exp` (e `route_id` se aplicável).

Chamadas ao Google sempre via gateway `https://connector-gateway.lovable.dev/google_maps/...` com `Authorization: Bearer ${LOVABLE_API_KEY}` e `X-Connection-Api-Key: ${GOOGLE_MAPS_API_KEY}`. Browser usa `VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY` somente para o mapa.

### Banco

Migration:
- Adiciona colunas em `company_settings`.
- Cria `route_suggestion_runs` (opcional, para auditoria): `id, created_at, created_by, payload jsonb, status`. GRANTs + RLS (`authenticated` ver/inserir seus runs; `service_role` all).

## Frontend

- Novo arquivo `src/routes/_authenticated/sugestao-rotas.tsx` com a tela.
- Item no menu (`AppShell`) "Sugestão de rotas".
- Componentes:
  - `SuggestionCard` (card de uma sugestão)
  - `SuggestionMap` (Maps JS API, lazy load, usa browser key + tracking ID, `google.maps.Marker` e `DirectionsRenderer`/polyline)
  - `EditSuggestionDrawer` (alterar data, motorista, remover/mover pedidos)
- Estado das sugestões em `useState` na página (não persistir entre sessões na 1ª versão).

## Detalhes técnicos

- Pedidos "sem rota" = `orders.dt_prev_exp = '4000-01-01'`.
- "Rotas existentes" candidatas = `routes` com `status='planejada'` e `route_date >= today`.
- Capacidade existente da rota = soma de `weight` e `total_amount` dos pedidos já vinculados via `route_orders`.
- Distance Matrix em batches de até 25 origens × 25 destinos.
- Tratamento de pedidos sem lat/lng após geocoding falho: exibidos com aviso e não entram nas sugestões até serem corrigidos manualmente.
- Sem alteração na lógica/ordenação das telas Pedidos e Rotas existentes.

## O que NÃO está no escopo

- Roteamento multi-veículo otimizado (Route Optimization API) — fica para uma evolução.
- Persistência das sugestões entre sessões / colaboração multiusuário.
- Cálculo de custo de frete por sugestão.
