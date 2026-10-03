# Dashboard: alternar entre calendário comercial e calendário normal

Classificação: **MINOR** (nova funcionalidade compatível) → v1.20.0

## O que muda para o usuário

- No topo do **Dashboard**, um seletor com duas opções: **Calendário normal** (padrão, comportamento atual) e **Calendário comercial**.
- Em "Calendário comercial", o gráfico **Pedidos por mês** passa a agrupar os pedidos pelos meses comerciais do ERP (tabela `erp_calendario_comercial`, alimentada pelo Sync ERP), usando o intervalo `de`–`ate` de cada mês comercial sobre a data de criação do pedido — em vez dos meses civis.
- O rótulo de cada barra mostra o mês comercial (ex.: "set/26") e o tooltip informa o período exato (ex.: "26/08 a 25/09").
- Se o calendário comercial ainda não estiver carregado no banco, o app avisa discretamente e mantém a visão normal.

## Escopo

- Afeta apenas o gráfico "Pedidos por mês". Os cartões de indicadores (KPIs) e "Tempo médio por etapa" não são por período e permanecem iguais.
- A escolha do usuário é lembrada (mesma preferência por usuário já usada em outras telas).

## Detalhes técnicos

- `src/routes/_authenticated/dashboard.tsx`:
  - consulta `erp_calendario_comercial` (mes_comerc, de, ate), reutilizando o padrão já existente em `pedidos.index.tsx`;
  - estado `calendario: "normal" | "comercial"` persistido em `user_table_preferences` (chave `dashboard:calendario`);
  - função de agrupamento mensal passa a receber os intervalos comerciais e atribuir cada pedido ao mês comercial cuja faixa `de`–`ate` contém `created_at`;
  - fallback para calendário normal quando a tabela estiver vazia ou indisponível.
- Sem migração de banco: a tabela `erp_calendario_comercial` já foi prevista (script entregue para execução manual); a tela deve funcionar mesmo antes de ela existir.
- Atualizar `src/config/version.ts` (1.20.0) e `CHANGELOG.md`.

## Riscos

- Baixo. Nenhuma alteração em banco, ERP ou integrações; somente leitura e apresentação.
- Se a tabela do calendário ainda não foi criada no banco compartilhado, o seletor aparece mas a opção comercial cai no fallback com aviso — sem erro.

## Checklist para publicar

- Testar no preview: alternar entre os dois calendários e conferir o gráfico e os tooltips.
- Confirmar se o script `2026-10-03_calendario_comercial.sql` já foi executado no banco e se o Sync ERP já populou o calendário.
- Nenhuma flag para ligar.
- Reversão: voltar à v1.19.1 pelo histórico do Lovable.
