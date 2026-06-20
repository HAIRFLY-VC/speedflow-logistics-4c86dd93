## Importação de Pedidos do ERP (Oracle)

Vamos integrar a API Oracle (do outro projeto) ao Speed Logística para trazer os pedidos ainda não expedidos, com sincronização automática (cron) e botão manual.

### 1. Secrets a criar
Vou pedir via `add_secret` (você cola os valores):
- `ERP_API_BASE_URL` — URL base da API Oracle (ex.: `https://erp.suaempresa.com/api`)
- `ERP_API_KEY` — Bearer/x-api-key
- `ERP_SYNC_SECRET` — segredo extra que o cron envia no header para autorizar o endpoint público (defesa em profundidade além do `apikey`)

### 2. Mudanças de schema (migração única)
- `orders`: adicionar coluna `erp_updated_at timestamptz` (para detectar mudanças do ERP) e índice único parcial em `erp_id` (já existe a coluna).
- `customers`: garantir índice único em `erp_id`.
- `products`: garantir índice único em `erp_id`.
- Nova tabela `erp_sync_runs` (auditoria de cada importação):
  - `started_at`, `finished_at`, `trigger` (`manual|cron`), `triggered_by` (uuid nullable), `orders_created`, `orders_updated`, `orders_skipped`, `errors` (jsonb), `status` (`success|partial|failed`)
  - RLS: SELECT para `adm`/`gestor`; INSERT/UPDATE apenas service_role
- Ajuste no trigger `enforce_order_status_transition`: permitir bypass quando a alteração vem com flag de sync do ERP (via `current_setting('app.erp_sync', true) = 'on'`) para o caso "Upsert completo, incluindo reset de status" — só reseta status de pedidos que **ainda não entraram em fluxo operacional** (status atual ∈ {`aguardando_aprovacao_comercial`, `aguardando_aprovacao_credito`, `aguardando_faturamento`}). Se já está em separação, transporte ou entregue, **preserva** o status local e só atualiza dados cadastrais/itens.

### 3. Server-side: lógica de sincronização
- `src/lib/erp-sync.server.ts` — helper privilegiado (carrega `supabaseAdmin` em runtime):
  - `fetchPendingOrdersFromErp()` — chama `GET {ERP_API_BASE_URL}/orders?status=not_shipped` com `Authorization: Bearer ${ERP_API_KEY}`. Valida resposta com Zod.
  - `syncOrders(payload, { trigger, userId })`:
    1. Abre registro em `erp_sync_runs`.
    2. Para cada pedido: upsert do `customers` (por `erp_id`) → upsert do `products` (por `erp_id`) → upsert do `orders` + `order_items` (transação via RPC ou múltiplas chamadas controladas).
    3. Aplica regra de preservação de status descrita acima.
    4. Acumula contadores e erros por pedido (não aborta o lote inteiro).
    5. Fecha o registro com `status` final.
- `src/lib/erp.functions.ts`:
  - `triggerErpSync` — `createServerFn` com `requireSupabaseAuth` + checagem `has_role(adm|gestor)`, dispara `syncOrders({ trigger: 'manual' })`.
  - `listSyncRuns` — server fn paginada para a tela de configurações.

### 4. Endpoint público para o cron
- `src/routes/api/public/hooks/erp-sync.ts` (POST):
  - Valida header `x-erp-sync-secret === process.env.ERP_SYNC_SECRET` (timing-safe). 401 se falhar.
  - Chama `syncOrders({ trigger: 'cron' })`.
  - Retorna `{ ok, created, updated, skipped, errors_count }`.

### 5. pg_cron
- Habilitar `pg_cron` + `pg_net` (se ainda não estiverem).
- Job `erp-sync-orders` a cada 15 min chamando `https://project--0f575c65-0542-477f-8d03-b4c26e47b952.lovable.app/api/public/hooks/erp-sync` com `apikey` + `x-erp-sync-secret`.

### 6. UI
- Em `src/routes/_authenticated/pedidos.index.tsx`: botão **"Importar do ERP"** (visível só para `adm`/`gestor`) com loading e toast mostrando resultado (`X criados, Y atualizados, Z ignorados`).
- Em `src/routes/_authenticated/configuracoes.tsx`: nova aba **"Sincronização ERP"** com:
  - Última execução (timestamp, trigger, resultado, erros expandíveis)
  - Tabela das últimas 20 execuções (`erp_sync_runs`)
  - Botão de sincronizar manualmente

### 7. Validação
- Após implementar: criar registro fake na tabela `erp_sync_runs` via teste? Não — vamos testar de verdade chamando o endpoint manual.
- Se você ainda não tem a API pronta/acessível, eu posso deixar um modo MOCK ativado por env (`ERP_API_MOCK=1`) que retorna 3 pedidos fictícios para você ver o fluxo funcionando ponta a ponta antes de plugar a Oracle real.

### Perguntas que vou precisar responder antes de começar a codar
1. **Formato da resposta da API Oracle**: você pode colar 1 exemplo de JSON de pedido que a API retorna (com cliente, itens, valor)? Sem isso, faço suposições sobre os nomes dos campos e mapeio errado.
2. **Endpoint exato** para "pedidos não expedidos": é `/orders?status=not_shipped`, `/sales-orders/pending`, ou outro caminho?
3. **Quer o modo MOCK** descrito no passo 7 para testar antes da API estar plugada?

Confirma o plano e me responde essas 3 perguntas que eu sigo direto para implementação.