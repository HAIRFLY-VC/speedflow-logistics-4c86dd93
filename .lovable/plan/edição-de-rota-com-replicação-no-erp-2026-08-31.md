# Edição de rota com replicação no ERP

Permitir que o usuário edite os dados da capa da rota no app e gravar a mesma alteração no ERP Oracle via API.

## O que o usuário poderá editar

Um botão "Editar rota" abre um modal com:

- **Data prevista (DT_PREV_EXP)** — opcional; seletor de data. Rotas sem data (sentinelas 01/01/3000 e 01/01/4000) começam vazias e podem receber uma data. Quando preenchida, o app envia a data formatada como `yyyyMMdd` no bind `dt_prev_exp_yyyyMMdd`. Se ficar em branco, o campo é enviado nulo ao ERP.
- **Nome da rota (NOME_ROTA)** — **único campo obrigatório**; texto livre convertido para maiúsculas ao salvar. Sem ele o botão salvar fica desabilitado.
- **Transportadora / fretista (COD_FRT_TRP + NOME_MOTORISTA)** — opcional; lista suspensa com busca, exibindo `RAZÃO SOCIAL (CÓDIGO ERP)`. A busca filtra por parte da razão social ou pelo código no ERP. Ao selecionar, o app grava o código e a razão social correspondente; é possível limpar a seleção, e nesse caso código e nome do responsável vão nulos (rota ainda sem responsável definido).

O campo `status` enviado ao ERP é o valor atual da rota retornado pelo ERP; para novas rotas o padrão é `P`. Para rotas existentes, o app mantém o `status` já salvo localmente. O tipo de frete (P/F/T), derivado da natureza do cadastro (EM/EF/ET), será utilizado em uma funcionalidade posterior e não é enviado neste update.


O modal fica disponível tanto na listagem de rotas quanto na tela de detalhamento da rota. Só é habilitado para rotas que possuem ID no ERP; rotas criadas manualmente no app continuam com a edição local existente.

## Fluxo de gravação

1. Usuário confirma a edição.
2. O app chama o ERP: `POST {ERP_API_BASE_URL}/v1/execute/update_capa_rota` com os binds `id`, `dt_prev_exp_yyyyMMdd`, `nome_rota`, `nome_motorista`, `cod_frt_trp` e `status`.
3. Se o ERP responder com erro, nada é alterado no app e a mensagem do ERP é exibida.
4. Com sucesso, o app atualiza a rota local (data, nome, responsável e vínculo com a transportadora quando houver cadastro com o mesmo código ERP) e recarrega a listagem.

Como a sincronização apaga e reinsere rotas pendentes, gravar primeiro no ERP garante que a alteração sobreviva ao próximo Sync.

## Detalhes técnicos

- Novo arquivo `src/lib/rota-erp.functions.ts` com duas server functions protegidas por `requireSupabaseAuth` (permitidas para adm/gestor/operador):
  - `listarResponsaveisErp` — executa em `/v1/query` a consulta `select TRIM(T.DBA_TIP_RAZAO_SOCIAL) RAZAO_SOCIAL, T.DBA_TIP_CODIGO_1 COD_ERP, T.DBA_TIP_NATUREZA COD_NAT from a_cadctipo t where t.dba_tip_natureza in ('EM','EF','ET')`, retornando `{ razaoSocial, codErp, tipoFrete }`. Consumida com `useQuery` e `staleTime` longo.
  - `atualizarCapaRotaErp` — valida entrada (id numérico da rota no ERP, data `yyyyMMdd`, nome, código e status) e faz o POST em `/v1/execute/update_capa_rota` com `X-API-Key`, timeout e tratamento de erro no mesmo padrão de `transportadora-erp.functions.ts`.
- Novo componente `src/components/routes/RouteEditDialog.tsx`: formulário com `Input`, `Popover` + `Command` (combobox com busca por razão social ou código) e botão salvar. Após sucesso do ERP, faz o update em `routes` (`route_date`, `code`/nome, `driver_name`, `carrier_id` quando localizado por `transportadoras.cod_erp`) e invalida as queries `["routes"]`.
- Integração em `src/routes/_authenticated/rotas.index.tsx` (ação na linha/card, sem disparar a navegação para o detalhamento) e em `src/routes/_authenticated/rotas.$routeId.tsx` (botão no cabeçalho).
- Schema: adicionar coluna `erp_status` em `routes` para guardar o `STATUS` vindo da tabela `A_GER_ROTAS` durante a sincronização, permitindo reenviá-lo no update. Os demais campos (`erp_route_id`, `driver_name`, `route_date`, `code`) já existem.
