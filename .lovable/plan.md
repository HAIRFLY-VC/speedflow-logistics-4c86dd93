# Painel de entregas em aberto

Nova tela para acompanhar os pedidos que já saíram (expedidos) e ainda não foram entregues, no formato da aba **ABERTOS** da planilha.

## O que a tela mostra

Item novo no menu: **Entregas em aberto** (perfis adm, gestor, operador).

Uma linha por nota fiscal em aberto, ordenada por idade (mais antiga primeiro), com:

- NF, cliente (código + razão social), UF, cidade
- RCA (vendedor), transportadora e modal (frota própria / particular / transportadora)
- Datas: pedido, faturamento, saída
- Dias desde o pedido e idade desde a saída
- Faixa de idade (0-2, 3-5, 6-10, 11-20, 21+ dias)
- Valor (R$), peso (kg), se é entrega agendada e nº de tentativas
- Campo editável: **Ação / responsável / prazo**

No topo: busca, filtros de múltipla seleção (UF, cidade, transportadora, RCA, modal, faixa de idade, filial) e um resumo com total de notas, valor e peso — recalculado conforme os filtros.

Layout compacto no mesmo padrão de "Pedidos sem rota", funcionando bem no celular.

## De onde vêm os dados

Do ERP, tabela `GKS.A_GERENTREGAS`, considerando as notas com **STATUS = 'A'** (em aberto) e data de saída preenchida. Confirmado no ERP: hoje há 215 notas nessa condição no ano corrente.

A sincronização roda junto com a que já existe (a cada 15 minutos e pelo botão de sincronizar), gravando um espelho no banco do app. A tela lê só o espelho, então abre rápido e não depende do ERP estar no ar.

Nome/cidade/bairro do cliente vêm do cadastro de clientes que o app já mantém; nome da transportadora/fretista, do cadastro de responsáveis já espelhado.

## Anotações do usuário

A ação/responsável/prazo é digitada na tela e guardada no app, ligada à nota fiscal. Fica preservada entre sincronizações e some da lista quando a nota é entregue.

## Detalhes técnicos

- Migração no banco central (`db/central/`):
  - `speedflow.entregas_abertas` — espelho do ERP: `nro_nf` + `cod_pedido` (chave), `cod_cliente`, `cod_vendedor`, `cod_filial`, `cod_agenda`, `bordero`, `dt_pedido`, `dt_fatur`, `dt_saida`, `dt_entrega_cli`, `dt_agendamento`, `entrega_agend`, `cod_transp_ent`, `tipo_transp_ent`, `placa_veiculo_ent`, `valor`, `peso`, `tipos_ocorrencia`, `status`, `atualizado_em`. Índices por `dt_saida` e `cod_cliente`.
  - `speedflow.entregas_acoes` — `nro_nf`/`cod_pedido` (PK), `acao` text, `responsavel` text, `prazo` date, `atualizado_por`, `atualizado_em`.
  - GRANTs para `authenticated` (leitura) e `service_role`; escrita das ações via server function.
- Sync: nova função `sincronizarEntregasAbertas()` em `src/lib/erp-sync.server.ts`, chamada dentro de `syncErpOrders` respeitando o `BUDGET_MS` já existente. Consulta única com `WHERE STATUS = 'A' AND DT_SAIDA IS NOT NULL AND DT_ENTREGA_CLI IS NULL`, upsert em blocos de 200 e remoção das notas que saíram da condição.
- Leitura na tela: `src/lib/entregas-abertas.functions.ts` — `listarEntregasAbertas()` (espelho + junção com `clientes_erp` e `erp_responsaveis`, cálculo de dias/faixa) e `salvarAcaoEntrega()` (papéis adm/gestor/operador).
- Tela: `src/routes/_authenticated/entregas-abertas.tsx`, reutilizando `MultiFiltro` de `src/components/pedidos-sem-rota/`; entrada em `NAV` de `src/components/layout/AppShell.tsx`.
- Datas do ERP chegam em UTC-3; normalizar para data local ao calcular idade.

## Fora deste escopo

As abas PAINEL, OCORRENCIAS, POR_UF/RCA/CLIENTE/TRANSPORTADORA e QUALIDADE da planilha — podem virar uma segunda etapa aproveitando o mesmo espelho.
