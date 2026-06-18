# Speed Logística — Plano de Implementação

Sistema para a Hairfly Cosméticos otimizar o ciclo do pedido de venda até a entrega, com 4 papéis (ADM, GESTOR, OPERADOR, FRETISTA), máquina de estados do pedido e rastreabilidade completa.

## Stack

- Frontend: TanStack Start + React + TypeScript + Tailwind + shadcn/ui + Lucide
- Backend: **Lovable Cloud** (Supabase gerenciado) — Postgres, Auth, RLS, Storage
- Server-side: `createServerFn` do TanStack Start (sem Edge Functions)
- Estado de servidor: TanStack Query
- Auth: email/senha (Supabase Auth) com proteção de rotas por role via layout `_authenticated`

## Ordem de entrega (cada item é uma entrega isolada; paro e mostro antes de seguir)

1. **Habilitar Lovable Cloud + Schema completo + RLS** ← começamos aqui
2. Auth (login/cadastro) + proteção de rotas por role + redirecionamento por papel
3. Layout base (sidebar por role, dark mode, responsivo) + Dashboard com KPIs + Kanban
4. CRUD de Clientes e Produtos
5. CRUD de Pedidos + tela de detalhe com histórico de status
6. Fluxo de aprovações (comercial e crédito) com transições de status
7. Faturamento + Separação
8. Fretistas, Rotas e Borderô
9. Entrega + Canhoto (upload de foto/assinatura em Storage)
10. Gestão de usuários (ADM) + configurações

---

## Entrega 1 — Schema Supabase + RLS (detalhe técnico)

### Enums

- `app_role`: `adm | gestor | operador | fretista`
- `order_status`:
  `aguardando_aprovacao_comercial | aguardando_aprovacao_credito | aguardando_faturamento | em_separacao | aguardando_roteirizacao | faturado | em_transporte | entregue | reprovado_comercial | reprovado_credito | cancelado`

### Tabelas

- `profiles` (1:1 com `auth.users`) — nome, telefone, ativo
- `user_roles` (tabela separada, conforme padrão de segurança) — `user_id`, `role`
- `customers` — clientes B2B (CNPJ, razão social, endereço, geolocalização, `erp_id`)
- `products` — SKU, nome, preço, estoque, peso
- `freight_carriers` (fretistas) — vinculados opcionalmente a um `user_id` para login
- `orders` — número, cliente, vendedor, valor total, status (enum), `current_status_since`, `erp_id`
- `order_items` — produto, quantidade, preço
- `order_status_history` — auditoria: `order_id`, `from_status`, `to_status`, `changed_by`, `changed_at`, `note`
- `approvals` — `order_id`, `type` (comercial/credito), `decision`, `decided_by`, `decided_at`, `reason`
- `invoices` (faturamento) — `order_id`, `nfe_number`, `nfe_key`, `boleto_url`, `issued_at`
- `picking_tasks` (separação) — `order_id`, `picker_id`, `started_at`, `finished_at`
- `routes` — `carrier_id`, `route_date`, `status`, métricas
- `route_orders` (N:N orders↔routes)
- `delivery_manifests` (borderô) — `route_id`, `code`, `issued_at`, `issued_by`
- `deliveries` — `order_id`, `delivered_at`, `received_by`, `notes`
- `delivery_receipts` (canhotos) — `delivery_id`, `photo_url` (Storage), `signature_url`

### Funções e triggers

- `has_role(_user_id uuid, _role app_role) returns boolean` — SECURITY DEFINER (evita recursão RLS)
- `handle_new_user()` — cria `profiles` ao inserir em `auth.users`
- `set_updated_at()` — trigger em todas as tabelas
- `enforce_order_status_transition()` — trigger BEFORE UPDATE em `orders`: valida a máquina de estados (só permite avançar conforme regras) e grava `order_status_history` automaticamente
- Função `transition_order_status(order_id, to_status, note)` para uso pelo app (RPC)

### Máquina de estados (validada no trigger)

```text
aguardando_aprovacao_comercial → aguardando_aprovacao_credito | reprovado_comercial | cancelado
aguardando_aprovacao_credito   → aguardando_faturamento | reprovado_credito | cancelado
aguardando_faturamento         → em_separacao | cancelado
em_separacao                   → aguardando_roteirizacao | cancelado
aguardando_roteirizacao        → faturado | cancelado
faturado                       → em_transporte | cancelado   (exige route_orders + invoice)
em_transporte                  → entregue
```

### GRANTs e RLS (uma policy por role)

Para CADA tabela em `public`:
1. `GRANT` apropriado a `authenticated` e `service_role`
2. `ENABLE ROW LEVEL SECURITY`
3. Policies explícitas:
   - **ADM/GESTOR**: SELECT/INSERT/UPDATE/DELETE em tudo (via `has_role`)
   - **OPERADOR**: SELECT em tudo operacional, UPDATE conforme etapa do fluxo
   - **FRETISTA**: SELECT apenas em `routes`, `route_orders`, `orders`, `deliveries`, `delivery_receipts` ligados ao seu `freight_carriers.user_id`; INSERT em `deliveries` e `delivery_receipts` apenas das suas rotas
4. `user_roles`: SELECT só do próprio usuário ou ADM; INSERT/UPDATE/DELETE só ADM

### Storage

- Bucket privado `delivery-receipts` com policies: fretista grava nos próprios; ADM/GESTOR/OPERADOR leem tudo

### Índices

- `orders(status)`, `orders(customer_id)`, `order_status_history(order_id, changed_at)`, `route_orders(route_id)`, `deliveries(order_id)`

### Entregável desta etapa

- Migração SQL completa aplicada via Lovable Cloud
- Documento curto explicando o schema e como testar a RLS

---

## Padrões aplicados em todas as entregas

- Componentes pequenos, tipados, em `src/components/<dominio>/`
- Server functions em `src/lib/<dominio>.functions.ts` com `requireSupabaseAuth`
- Validação com Zod no frontend E nas server functions
- Toasts (sonner) para feedback, skeletons para loading, empty states desenhados
- Rotas protegidas sob `src/routes/_authenticated/` (layout gerenciado pela integração)
- Mobile-first (essencial para o fretista)

Confirma que posso iniciar pela **Entrega 1 (habilitar Lovable Cloud + schema + RLS)**?
