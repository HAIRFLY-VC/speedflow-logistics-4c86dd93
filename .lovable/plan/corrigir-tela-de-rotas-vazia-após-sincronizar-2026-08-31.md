# Corrigir tela de Rotas vazia após sincronizar

## Causa confirmada

A tela de Rotas mostra "0 registros" porque a consulta do app falha com:

```text
column routes.erp_status does not exist
```

Verificado agora:
- O banco central (esquema `speedflow`) tem 37+ rotas e 255 vínculos de pedidos — os dados existem.
- A coluna `erp_status`, criada na última alteração (edição de capa de rota no ERP), foi aplicada apenas no banco do projeto, não no banco central que a aplicação usa.
- Sem essa coluna, tanto a leitura da tela quanto a gravação de rotas na sincronização falham.

## Correção

1. Criar o script `db/central/2026-08-31_routes_erp_status.sql` (mesmo padrão dos demais scripts do banco central) com:
   - `ALTER TABLE speedflow.routes ADD COLUMN IF NOT EXISTS erp_status text;`
   - comentário descritivo da coluna.
2. Aplicar esse script no banco central.
3. Tornar a tela resiliente: exibir uma mensagem de erro quando a consulta de rotas falhar, em vez de mostrar silenciosamente "Nenhuma rota criada" — assim uma falha de consulta futura fica visível.
4. Validar após aplicar: recarregar a tela de Rotas e conferir que as rotas e os cards de totais voltam a aparecer, e rodar o Sync ERP para confirmar que a gravação de `erp_status` funciona.

## Detalhes técnicos

- Arquivos: novo `db/central/2026-08-31_routes_erp_status.sql`; ajuste de tratamento de erro em `src/routes/_authenticated/rotas.index.tsx` (query `["routes"]`).
- Nenhuma mudança na lógica de sincronização é necessária — `src/lib/erp-sync.server.ts` já envia `erp_status` corretamente.
