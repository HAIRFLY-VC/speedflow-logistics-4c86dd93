# Dashboard: filtro de mês pela data da agenda

## Classificação
PATCH (v1.21.1) — ajuste de comportamento do filtro de mês já existente, sem mudança de estrutura.

## O que muda
Hoje o filtro "Mês:" do Dashboard (calendário normal ou comercial) usa a data de criação do pedido (`created_at`). Passa a usar a **data da agenda** (`dt_agendamento`), que é a data de agendamento vinda do ERP.

## Detalhes
- `src/routes/_authenticated/dashboard.tsx`:
  - Incluir `dt_agendamento` na consulta de pedidos do Dashboard.
  - No filtro por mês (cartões de indicadores e lista "Pedidos por status"), comparar `dt_agendamento` com o período selecionado (mês civil ou período comercial), em vez de `created_at`.
  - Pedidos sem data de agenda usam a data do pedido (`created_at`) como base para o filtro mensal, garantindo que nenhum pedido fique de fora.
  - O gráfico "Pedidos por mês" (tendência dos últimos 6 meses) também passa a agrupar por essa data efetiva (agenda ou, na falta, data do pedido), mantendo coerência com o filtro.
- Sem migração de banco, sem feature flag.

## Riscos
- Baixo: pedidos antigos sem `dt_agendamento` deixam de aparecer nos totais mensais; o gráfico mensal pode mudar levemente de forma.

## Checklist para publicar
- Testar no preview: trocar mês/calendário e conferir que os totais batem com as datas de agenda dos pedidos.
- Nenhuma migração; nenhuma flag para ligar.
- Reversão: voltar à v1.21.0 pelo histórico.
