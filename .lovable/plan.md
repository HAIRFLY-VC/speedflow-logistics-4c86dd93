# Corrigir o card "Na fila" do painel de Separação

## O que está errado

O painel lê uma **cópia** da separação guardada no banco central, e essa cópia está desatualizada e incompleta:

- O pedido 4135089 **não existe** nessa cópia; no ERP ele existe (incluído 15:20, iniciado 15:51).
- Na cópia, **nenhum** dos 13.520 registros está sem data de início — por isso "Na fila" sempre mostra zero.
- Consultando o ERP direto (tabela `GKS.A_SEPPEDIDO`), nos últimos 30 dias há 828 registros, sendo **4 ainda sem início** (fila real) e 21 sem conclusão.

Ou seja: o card está certo na regra (fila = sem data de início), mas os dados que ele lê não refletem o ERP.

## O que vou fazer

1. Passar o painel a ler a separação **direto do ERP**, usando a mesma via já usada pelos outros painéis (consulta ao ERP no servidor), em vez da cópia no banco central.
2. Duas consultas por carregamento:
   - **Em aberto**: tudo que ainda não foi concluído (sem data de fim de separação) — alimenta "Na fila" (sem data de início) e "Em separação" (com início e sem fim).
   - **Período**: concluídos dentro das datas escolhidas no filtro — alimenta tempos médios, produtividade, volume por dia e por hora.
3. Manter todos os cards, gráficos e filtros atuais; nada muda na aparência, só a origem dos dados.
4. Tratar o fuso: as datas vêm do ERP em UTC e serão exibidas no horário de Brasília, para que "há quanto tempo espera" fique correto.
5. Se o ERP estiver indisponível, mostrar aviso claro na tela em vez de números zerados.

## Detalhes técnicos

- Origem: `GKS.A_SEPPEDIDO` (COD_PEDIDO, COD_SEP, STATUS, QTD_CX_SEP, DT_INC, DT_INI_SEP, DT_FIM_SEP, DT_FIM_CONF, PRIORIDADE). O ERP não tem o nome do separador nessa tabela — o nome hoje vem da cópia; será resolvido por `COD_SEP` cruzando com o espelho existente (`clientes_erp`/`erp_responsaveis` conforme o cadastro do separador) e, se não houver nome, exibe o código.
- `src/lib/separacao.functions.ts`: substituir o `fetch` REST ao banco central por chamadas ao endpoint de consulta do ERP (`ERP_API_BASE_URL` + `X-API-Key`), no padrão de `src/lib/erp-sync.server.ts`, com binds de data e limite de linhas; manter `requireSupabaseAuth` + `ensureStaff`.
- Filtro do período por `DT_FIM_SEP BETWEEN :inicio AND :fim`; consulta de abertos por `DT_FIM_SEP IS NULL` (sem limite de data).
- `src/routes/_authenticated/separacao.tsx`: sem mudança de layout; apenas ajuste de tipos/campos caso o nome do separador passe a vir resolvido pelo servidor.
- Verificação: conferir que o pedido 4135089 aparece como concluído hoje e que os registros sem `DT_INI_SEP` aparecem no card "Na fila".
