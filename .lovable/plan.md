# Nova tela: Autorizar pagamento de frete

## O que será feito

Criar uma nova tela **Autorizar pagamento de frete** que exibe as mesmas informações da tela **Rotas Pendentes**, porém filtrada para mostrar apenas rotas cujos pedidos já tenham borderô informado. O objetivo é separar o momento de autorização de pagamento do fluxo geral de rotas pendentes.

## Como será feito

### 1. Refatorar `src/routes/_authenticated/rotas.index.tsx`

Extrair os trechos reutilizáveis para novos módulos compartilhados, sem alterar o comportamento da tela atual:

- `src/lib/rotas-view.ts`
  - Tipos: `RouteRow`, `TipoFrete`, `TransportadoraLite`.
  - Constantes: `ROUTE_STATUS_LABEL`, `ROUTE_STATUS_TONE`, `TIPO_FRETE_LABEL`, `TIPO_FRETE_TONE`.
  - Helpers puros: `formatRouteDate`, `routeDateSortKey`, `nomeRotaOf`, `normalizaCod`, `normalizaNome`, `slugify`, `motoristaOf`, `resolveTransportadora`, `paradasOf`, `pedidosOf`, `valorOf`, `pesoOf`, `statusMapOf`, `StatusList`.
  - Formatadores: `currencyFmt`, `weightFmt`.

- `src/hooks/useRotasData.ts`
  - Hook `useRotasData()` que retorna tudo o que a tabela precisa:
    - rotas carregadas (`routes`), estado de loading/erro;
    - depósito (`depot`);
    - transportadoras, responsáveis, naturezas, códigos por rota;
    - mapas de estimativa (`estimativas`), borderô (`borderos`), função `borderoDaRota(r)`;
    - funções derivadas: `tipoFreteOf(r)`, `responsavelPorRota`, `freteOf(r)`;
    - refs e efeitos de sincronização de códigos ausentes.
  - Mantém as mesmas `queryKey` para aproveitar cache entre as duas telas.

- `src/components/routes/RotasTable.tsx`
  - Componente que recebe `routes`, `isLoading`, `error`, `borderoDaRota`, `freteEditado/setFreteEditado`, `pagamento/setPagamento`, `editRoute/setEditRoute`, etc.
  - Monta as mesmas colunas da tabela de Rotas Pendentes, incluindo `FreightInput`, `DistanceCell` e ações.
  - Permite passar uma prop `filter` para restringir as linhas exibidas.

### 2. Criar a nova rota

- `src/routes/_authenticated/autorizar-pagamento-frete.tsx`
  - Título: "Autorizar pagamento de frete — SpeedFlow Logistics".
  - Usa `useRotasData()` e `<RotasTable />`.
  - Aplica filtro: `bordero.total > 0 && bordero.comBordero === bordero.total`.
  - Remove cards/totais desnecessários para essa tela (ou mantém apenas os totais das rotas filtradas).
  - Não exibe botão "Nova rota" nem o botão geral "Atualizar rotas"; a atualização continua sendo feita em Rotas Pendentes.
  - Mantém o diálogo de confirmação de pagamento (`PagamentoRotaDialog`) e o diálogo de edição de rota (`RouteEditDialog`).

### 3. Atualizar `src/routes/_authenticated/rotas.index.tsx`

- Substituir o código extraído pelas importações dos novos módulos.
- Manter o diálogo "Nova rota" e o botão "Atualizar rotas", que são específicos dessa tela.
- Comportamento visual e funcional permanece idêntico ao atual.

### 4. Menu lateral

- Em `src/components/layout/AppShell.tsx`, adicionar item:
  - Título: "Autorizar pagamento de frete"
  - URL: `/autorizar-pagamento-frete`
  - Ícone: `ShieldCheck` (ou `Wallet` se disponível)
  - Papéis: adm, gestor, operador

## O que não muda

- Nenhuma alteração no banco de dados.
- Nenhuma alteração no fluxo de confirmação de pagamento (`PagamentoRotaDialog`, `rota-pagamento.server.ts`).
- Nenhuma alteração nas permissões ou regras de negócio.
- A URL `/rotas` continua funcionando exatamente como hoje.

## Verificação

- `bunx tsgo --noEmit` sem erros.
- Build OK (`/tmp/observability/build-errors.log`).
- Playwright: acessar `/autorizar-pagamento-frete` e confirmar que só aparecem rotas com todos os pedidos faturados/borderô informado; acessar `/rotas` e confirmar que continua igual.
