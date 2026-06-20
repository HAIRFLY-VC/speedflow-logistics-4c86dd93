## Objetivo
Cadastrar rotas automaticamente a partir dos pedidos importados do ERP, usando `DT_PREV_EXP` (data planejada de saída), `NOME_ROTA` (nome) e `NOME_MOTORISTA` (motorista, texto livre).

## Mudanças

### 1. Banco de dados (migração)
- `routes`: adicionar coluna `driver_name text` (substitui o uso do `carrier_id` para rotas vindas do ERP). Manter `carrier_id` opcional (não removo agora para não quebrar rotas/borderôs existentes).
- Tornar `routes.code` único por `(route_date, code)` continua igual; o código será derivado do nome da rota.
- Sem alterações em `route_orders`.

### 2. Sincronização ERP (`src/lib/erp-sync.server.ts`)
Após processar cada pedido, e antes de fechar a execução:
- Agrupar pedidos por chave `NOME_ROTA + DT_PREV_EXP + NOME_MOTORISTA` (ignorando registros com `NOME_ROTA` vazio ou com as datas sentinela `3000-01-01` / `4000-01-01`).
- Para cada grupo:
  - `upsert` em `routes` usando `code = slug(NOME_ROTA)-YYYYMMDD` como chave natural: se existir, atualiza `driver_name` e `route_date`; senão cria com `status='planejada'`, `total_freight=0`.
  - Inserir em `route_orders` os pedidos do grupo que ainda não estejam vinculados (sem mover pedidos já em outra rota).
- Contabilizar no resultado: `routes_created`, `routes_updated`, `route_orders_linked` (campos adicionais em `erp_sync_runs` — opcional, posso só logar).

### 3. Tela de Rotas (`src/routes/_authenticated/rotas.index.tsx`)
- Tabela passa a exibir: **Código**, **Data planejada (DT_PREV_EXP)**, **Nome da rota**, **Motorista**, **Paradas**, **Status**.
- Coluna "Fretista" é substituída por "Motorista" (texto `driver_name`, com fallback para `freight_carriers.full_name` quando existir).
- Diálogo "Nova rota": substituir campo *Fretista (select)* por *Nome da rota* (texto) e *Motorista* (texto). Data continua sendo `route_date` (renomeada para "Data planejada de saída"). Frete e observações permanecem.
- O `code` da rota manual passa a ser derivado de `slug(nome_rota)-YYYYMMDD`.

### 4. Types (`src/integrations/supabase/types.ts`)
Adicionar `driver_name: string | null` em `routes.Row/Insert/Update` (regenerado após a migração).

## Detalhes técnicos
- Slug helper local: minúsculas, remove acentos, troca não-alfanum por `-`.
- Datas sentinela do ERP (`3000-01-01`, `4000-01-01`) significam "sem rota definida" → não geram rota.
- Vínculo `route_orders` usa `ON CONFLICT DO NOTHING` (chave única `(route_id, order_id)`); se um pedido já estiver em outra rota, ele é ignorado e gravado em `errors` para visibilidade.
- Concorrência: a criação de rotas roda sequencial após o loop de pedidos para evitar corrida no upsert.
