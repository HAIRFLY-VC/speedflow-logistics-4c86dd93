# Corrigir erro "routes.erp_carrier_code does not exist"

## O que está acontecendo

A tela de Rotas consulta o banco central (esquema `speedflow`), mas a coluna nova `erp_carrier_code` só foi criada no banco do app. Como o código já pede essa coluna na consulta, o banco central rejeita a requisição inteira e a tela mostra "Não foi possível carregar as rotas" com 0 registros.

## Correção

1. Criar o arquivo de alteração do banco central `db/central/2026-08-31_routes_erp_carrier_code.sql`:
   - adicionar a coluna de texto `erp_carrier_code` em `speedflow.routes` (se ainda não existir), com comentário indicando que guarda o código do responsável vindo do ERP (`COD_FRT_TRP`).
2. Aplicar essa alteração no banco central, do mesmo modo já usado para a coluna `erp_status`.
3. Validar depois de aplicar:
   - a listagem de rotas volta a carregar (sem a faixa vermelha);
   - a sincronização com o ERP grava o código do responsável;
   - o modal de edição abre já com a transportadora selecionada (caso 201340).

Nenhuma mudança de layout ou de regra de negócio: o card continua com o ID em primeiro e o lápis só no topo direito.

## Detalhes técnicos

- `ALTER TABLE speedflow.routes ADD COLUMN IF NOT EXISTS erp_carrier_code text;`
- Nenhuma alteração necessária em `src/lib/erp-sync.server.ts`, `rotas.index.tsx`, `rotas.$routeId.tsx` ou `RouteEditDialog.tsx` — o código já está pronto, só falta a coluna existir no central.
- Se o `ALTER` não puder ser executado pelas ferramentas, entrego o SQL para execução direta no banco central.
