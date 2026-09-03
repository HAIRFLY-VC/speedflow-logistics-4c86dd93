# Pedidos sem rota

Nova tela no menu, otimizada para celular, para roteirizar rapidamente os pedidos que ainda não têm data de previsão de expedição.

## O que a tela faz

- Item novo no menu lateral: **Pedidos sem rota** (perfis adm, gestor, operador), logo abaixo de "Pedidos".
- Lista apenas pedidos cuja data de previsão de expedição é **01/01/4000** (a data-sentinela de "Não planejado").
- Layout compacto pensado para o celular: cada pedido é uma linha curta com checkbox à esquerda e, em duas linhas:
  - nome (ou código) do cliente + cidade;
  - número do pedido, valor e peso.
- Busca por cliente/cidade/número do pedido no topo, em largura total.
- Barra fixa no rodapé enquanto houver seleção: "N selecionados · peso · valor" e o botão **Atribuir a uma rota**.
- Ações auxiliares: "Selecionar todos os visíveis" e "Limpar seleção".

## Filtros

Botão **Filtros** ao lado da busca (com contador de filtros ativos) que abre um painel por baixo, com cinco listas de **múltipla seleção**, cada uma mostrando as opções realmente presentes nos pedidos da tela e a quantidade de pedidos por opção:

- Estado (UF)
- Cidade
- Bairro
- Agenda
- Filial

Regras: dentro de um mesmo filtro as opções somam (OU); entre filtros elas se cruzam (E). Cidade e bairro se restringem às opções compatíveis com o que já estiver selecionado acima. Botão "Limpar filtros" e resumo em chips removíveis logo abaixo da busca. Selecionar todos os visíveis respeita os filtros ativos.


## Atribuição

O botão abre uma folha (sheet) com duas abas:

1. **Rota existente** — lista de rotas pendentes (as mesmas da tela de Rotas), com busca por nome/ID.
2. **Nova rota** — formulário curto, nesta ordem:
   - Data de previsão de expedição (obrigatória)
   - Nome da rota (obrigatório)
   - Responsável — fretista/transportadora (opcional)

Ao confirmar:
- Grava o vínculo pedido↔rota no app (tabela de paradas da rota) e cria a rota no app quando for nova.
- Replica no ERP: cria/atualiza a capa da rota e vincula cada pedido selecionado à rota.
- Mostra o resultado por pedido (sucesso/erro) e mantém selecionados apenas os que falharam.

## Detalhes técnicos

- Rota nova: `src/routes/_authenticated/pedidos-sem-rota.tsx`; entrada em `NAV` de `src/components/layout/AppShell.tsx`.
- Leitura: `orders` filtrando `dt_prev_exp` no dia 4000-01-01, com `erp_cod_cliente`, `order_number`, `total_amount`, `weight`, `erp_id`, `cod_agenda`, `cod_filial`; nome, bairro, cidade e UF via hook existente `useClientesErp` (espelho `speedflow.clientes_erp`, que já tem esses campos).
- Filial: hoje `COD_FILIAL` vem do ERP mas não é gravada — adiciono a coluna `cod_filial` em `orders` (migração) e passo a gravá-la em `src/lib/erp-sync.server.ts`. Até a próxima sincronização o filtro de filial fica vazio.
- Filtros: derivados em memória a partir dos pedidos carregados (nada de round-trip por filtro); estado dos filtros em `useState` com componentes existentes (Popover/Sheet + Checkbox).
- Lista renderizada como cartões próprios (não o `DataTable`), para manter a tela realmente compacta no celular.
- Gravação local: `routes` (quando nova) + `route_orders`, seguindo o mesmo padrão do detalhe de rota.
- Gravação no ERP: reutiliza `atualizarCapaRotaErp` (`/v1/execute/update_capa_rota`) para a capa. O vínculo pedido↔rota no ERP vive em `A_GER_ROTAS_PEDIDOS` e hoje **não existe endpoint** para gravá-lo — será preciso expor uma procedure nova na API do ERP (proposta: `/v1/execute/insert_rota_pedido` com binds `id_rota` e `pedido`, e `/v1/execute/insert_capa_rota` para criar a capa). Vou implementar a função de servidor `vincularPedidosRotaErp` já chamando esse endpoint; enquanto a procedure não estiver publicada no ERP, a tela grava no app e avisa que a replicação no ERP falhou, sem perder a seleção.
- Única mudança de banco: a coluna `cod_filial` em `orders`; `routes` e `route_orders` já atendem.

## Validação

Conferência em viewport de celular (390px): filtro correto (só 01/01/4000), seleção múltipla, criação de rota nova e atribuição a rota existente, com mensagens de erro do ERP visíveis.
