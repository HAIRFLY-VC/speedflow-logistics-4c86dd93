# Painel de Separação: ler direto do ERP e corrigir o card "Na fila"

## O que está errado

O painel lê hoje uma **cópia** da separação guardada no banco central, e essa cópia está desatualizada e incompleta:

- O pedido 4135089 **não existe** nessa cópia; no ERP ele existe (incluído 15:20, iniciado 15:51).
- Na cópia, **nenhum** registro está sem data de início — por isso "Na fila" sempre mostra zero.
- Consultando o ERP direto, nos últimos 30 dias há 828 registros, sendo **4 ainda sem início** (fila real) e 21 sem conclusão.

## O que vou fazer

1. Trocar a origem dos dados do painel para uma leitura **direta no ERP**, usando exatamente a consulta informada (separação a partir de 01/01/2025, já trazendo o nome do separador pelo cadastro).
2. Usar esses dados para tudo: fila (sem data de início), em separação (com início e sem fim), concluídos do período, tempos médios, produtividade, volume por dia e por hora.
3. Adicionar um botão **Atualizar** no topo do painel: relê os dados no ERP na hora, com indicação de carregamento e o horário da última atualização ao lado.
4. Manter cards, gráficos e filtros como estão; muda apenas a origem e a atualização dos dados.
5. Se o ERP estiver indisponível, exibir aviso claro em vez de números zerados.
6. Ajustar o fuso: as datas do ERP são exibidas no horário de Brasília, para que os tempos de espera fiquem corretos.

## Detalhes técnicos

- `src/lib/separacao.functions.ts`: remover o `fetch` REST ao banco central e passar a chamar o endpoint de consulta do ERP (`ERP_API_BASE_URL` + header `X-API-Key`), no padrão de `src/lib/erp-sync.server.ts` (retry em erros transitórios, mensagem amigável). Mantém `requireSupabaseAuth` + `ensureStaff`.
- SQL usado (com filtro de período adicional aplicado por bind quando o usuário restringe as datas, mantendo sempre os registros em aberto):

```text
select s.cod_pedido, s.cod_sep, trim(t.dba_tip_nome_fantasia) separador,
       s.status, s.qtd_cx_sep, s.dt_inc, s.dt_ini_sep, s.dt_fim_sep,
       s.dt_fim_conf, s.prioridade
  from gks.a_seppedido s, gks.a_cadctipo t
 where s.dt_inc >= to_date('20250101','yyyyMMdd')
   and t.dba_tip_codigo_1 = s.cod_sep
```

- Duas leituras por carregamento, para não trafegar tudo: concluídos no período do filtro (`dt_fim_sep between :inicio and :fim`) e todos os não concluídos (`dt_fim_sep is null`), ambos sobre o SQL acima; `limit` alto no endpoint e aviso se houver truncamento.
- Datas do ERP chegam em ISO UTC; converter para `America/Sao_Paulo` nos cálculos de tempo e nos gráficos por dia/hora.
- `src/routes/_authenticated/separacao.tsx`: botão Atualizar com `refetch()` (`staleTime: 0`), ícone `RefreshCw` animado enquanto carrega e `dataUpdatedAt` formatado; sem mudanças de layout.
- Verificação: pedido 4135089 aparece como concluído hoje e os registros sem `dt_ini_sep` aparecem no card "Na fila".
