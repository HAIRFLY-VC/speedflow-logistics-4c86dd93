# Calendário comercial do ERP (Sync ERP + filtro em Pedidos)

Classificação: MINOR (nova funcionalidade, sem quebra). Banco compartilhado teste/produção — migração apenas cria tabela nova (retrocompatível).

## O que muda

1. **Nova tabela no banco central** `erp_calendario_comercial` com as colunas:
   - `mes_comerc` (date, chave) — primeiro dia do mês comercial;
   - `de` (date) e `ate` (date) — período de datas que compõe o mês comercial;
   - `atualizado_em` (timestamptz).
   Migração em `db/central/`, aplicada no banco central compartilhado.

2. **Sync ERP passa a atualizar o calendário**: em `src/lib/erp-sync.server.ts`, nova etapa executa a query fornecida (`gks.a_cadctabe`, chaves `050FATPED-%`, meses a partir de 01/2026) e faz upsert na tabela. Roda em todo sync (manual e automático); se falhar, o restante do sync continua e o erro é registrado no histórico — mesmo padrão do espelho de responsáveis.

3. **Filtro por mês comercial na tela Pedidos**: novo filtro "Mês comercial" (ex.: "2026-09 · 31/08 a 27/09") que filtra os pedidos cuja data de faturamento/emissão cai entre `de` e `ate` do mês selecionado. Os meses disponíveis vêm da tabela sincronizada.

## Detalhes técnicos

- `db/central/2026-10-03_calendario_comercial.sql`: CREATE TABLE + índice por período.
- `src/lib/erp-sync.server.ts`: constante `CALENDARIO_COMERCIAL_SQL` com a query exata fornecida; função `sincronizarCalendarioComercial()` chamada dentro de `syncErpOrders` (com `.catch` registrando em `errors`, sem abortar o sync).
- `src/integrations/central/types.ts`: tipagem da nova tabela.
- `src/routes/_authenticated/pedidos.index.tsx`: filtro de mês comercial usando a data relevante do pedido (faturamento/emissão) contra o intervalo `de`/`ate`.
- Sem feature flag (política: oficial = teste). Versão: 1.19.0 com entrada no CHANGELOG.

## Riscos e reversão

- Risco baixo: tabela nova, etapa extra no sync isolada com tratamento de erro.
- Reversão: versão anterior pelo histórico do Lovable; a tabela pode permanecer sem uso (ou `DROP TABLE erp_calendario_comercial`).

## Checklist para publicar

- Testar no preview: rodar "Sync ERP" e conferir meses comerciais carregados; abrir Pedidos e filtrar por um mês comercial.
- Migração aplicada no banco compartilhado: `2026-10-03_calendario_comercial.sql`.
- Flags: nenhuma.
- Reverter: histórico do Lovable (v1.18.3) + drop da tabela, se necessário.
