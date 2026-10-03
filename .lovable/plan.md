# Dashboard: filtro por mês (calendário normal ou comercial)

Classificação: **MINOR** (nova funcionalidade compatível) → v1.21.0

## O que muda para o usuário

- No topo do **Dashboard**, além do seletor "Analisar por:" (calendário normal/comercial), aparece um seletor **"Mês:"**.
- Os meses oferecidos respeitam o modo escolhido:
  - **Calendário normal**: meses civis (lista dos últimos 12 meses, do mais recente para trás).
  - **Calendário comercial**: os meses comerciais do ERP (`erp_calendario_comercial`), com rótulo **mês + período** — ex.: "set/26 (26/08 a 25/09)".
- Ao abrir o Dashboard, o filtro já vem posicionado no **mês atual** (no modo comercial, o mês comercial vigente; se o calendário comercial não estiver carregado, cai no mês civil atual, como hoje).
- **O filtro vale para os cartões de indicadores (KPIs) e para a lista "Pedidos por status"** — ambos passam a considerar apenas os pedidos criados dentro do período do mês selecionado.
- O gráfico **"Pedidos por mês"** continua mostrando a série dos últimos 6 meses (visão de tendência) e não é afetado pelo filtro; "Tempo médio por etapa" também permanece igual (não é por período).
- Se nenhum pedido existir no mês selecionado, os cartões mostram zero e a lista de status exibe a mensagem de "nenhum pedido" — sem erro.

## Detalhes técnicos

- `src/routes/_authenticated/dashboard.tsx`:
  - novo estado `mesSelecionado: string` (chave do mês: civil `YYYY-MM` ou comercial `mes_comerc`), inicializado como mês atual — no modo comercial, o mês comercial cuja faixa `de`–`ate` contém a data atual;
  - ao trocar o modo de calendário, recalcula o mês selecionado para o equivalente vigente no novo modo (e reseta se o mês não existir na nova lista);
  - função que filtra `orders` por `created_at` dentro do período: no modo normal, do primeiro ao último dia do mês civil; no modo comercial, usando `de`–`ate` do mês comercial (inclusive);
  - `totals` (cartões) e `byStatus` (lista "Pedidos por status") passam a usar a lista filtrada; o gráfico mensal continua usando a lista completa;
  - seletor de mês usa o mesmo componente `Select` já presente na tela; no modo comercial, o item mostra "set/26 (26/08 a 25/09)".
- A lista de pedidos continua sendo a consulta atual (limite de 500, mais recentes); sem migração de banco.
- Sem preferência persistida para o mês: cada abertura volta ao mês atual, conforme decidido.
- Atualizar `src/config/version.ts` (1.21.0) e `CHANGELOG.md`.

## Riscos

- Baixo. Somente leitura e apresentação; nenhuma alteração em banco, ERP ou integrações.
- Se houver mais de 500 pedidos no mês, os cartões podem ficar incompletos — limitação já existente da consulta, não agravada por este filtro.

## Checklist para publicar

- Testar no preview: alternar calendário normal/comercial, trocar o mês e conferir cartões, lista de status e a mensagem quando o mês não tem pedidos.
- Confirmar que o calendário comercial está populado no banco (Sync ERP) para o modo comercial listar os meses.
- Nenhuma migração aplicada; nenhuma flag para ligar.
- Reversão: voltar à v1.20.1 pelo histórico do Lovable.
