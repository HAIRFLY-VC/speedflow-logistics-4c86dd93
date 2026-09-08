# Escolher quais colunas aparecem em "Entregas em aberto"

## O que muda

Um botão **Colunas** na barra do painel abre uma lista com todas as colunas disponíveis. O usuário marca as que quer ver e desmarca as que não quer. A escolha fica salva no perfil dele e volta automaticamente na próxima vez.

## Colunas novas disponíveis (hoje não aparecem)

Todas já vêm da consulta de entregas do ERP e já estão gravadas:

- Cód. cliente
- Cód. vendedor (RCA)
- Agenda
- Borderô
- Dt. agendamento
- Dt. entrega ao cliente
- Cód. transportadora
- Tipo de transporte
- Placa do veículo
- Tipos de ocorrência
- Situação
- Atualizado em

As colunas atuais (NF, Pedido, Cliente, UF, Cidade, RCA, Transportadora, Modal, Filial, datas, Dias, Faixa, Valor, Peso, Agendada, Ação/Responsável/Prazo) continuam iguais e visíveis por padrão; as novas entram ocultas por padrão para não poluir a tela.

## Comportamento

- Marcar/desmarcar aplica na hora, sem recarregar.
- Ocultar uma coluna também remove o filtro dela do resultado, evitando filtro invisível.
- Filtros por coluna, ordenação, busca e o rodapé de totais continuam funcionando.
- A exportação para Excel exporta exatamente as colunas visíveis, na ordem exibida.
- As visões de filtro salvas passam a guardar também a seleção de colunas, então aplicar uma visão compartilhada reproduz o mesmo layout.
- Botão "Restaurar padrão" volta à seleção original.

## Detalhes técnicos

- `src/routes/_authenticated/entregas-abertas.tsx`: ampliar a lista `colunas` com os campos acima (tipos `text`/`date` corretos para os filtros estilo Excel), e filtrar a lista pelas colunas visíveis antes de renderizar, exportar e montar filtros.
- Ampliar a linha lida em `entregas_abertas` no `select` para incluir `bordero`, `dt_agendamento`, `dt_entrega_cli`, `tipos_ocorrencia`, `status`, `atualizado_em`.
- `src/components/data-table/useColumnFilterPrefs.ts`: guardar também `visibleColumns` em `user_table_preferences` (mesma chave `entregas-abertas`, gravação com debounce já existente).
- Reaproveitar o padrão visual do `ColumnsManager` existente para o popover de seleção.
- `src/lib/filter-views.functions.ts` / `FilterViewsBar`: incluir a seleção de colunas no JSON da visão salva/compartilhada, com retrocompatibilidade para visões antigas sem esse campo.

## Critério de aceite

- Botão Colunas lista todas as colunas, com as novas do ERP incluídas.
- Marcar/desmarcar reflete no grid e na exportação.
- Ao reabrir o painel, a seleção salva é restaurada.
