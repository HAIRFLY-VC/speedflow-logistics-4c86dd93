# Ajustes no card de rota e na pré-seleção da transportadora

## 1. ID como primeiro campo do card

Hoje a coluna "ID" existe, mas usuários que já usavam a tela têm uma ordem de colunas salva; colunas novas entram no fim da lista. Por isso o card começa pela data e mostra o ID lá embaixo.

Mudança: fixar a coluna "ID" como a primeira da tabela/card, ignorando a ordem salva anteriormente (a coluna passa a ser "pinada" no início).

## 2. Remover o lápis do rodapé do card

A coluna de ações continua existindo no modo tabela (PC), mas deixa de ser renderizada como um campo do card no mobile. O único acesso à edição no card passa a ser o botão do canto superior direito.

## 3. Transportadora não pré-selecionada (caso do código 201340)

O código usado para pré-selecionar hoje vem do cadastro local de transportadoras (`transportadoras.cod_erp`) — não do código que veio do ERP na rota (`COD_FRT_TRP`). Quando a transportadora não está cadastrada localmente com aquele código, a tela abre sem nada selecionado, que é o comportamento visto no exemplo.

Plano:

1. Passar a guardar o `COD_FRT_TRP` retornado pela sincronização direto na rota (nova coluna `erp_carrier_code` em `routes`) e usá-lo como código inicial do modal, com o cadastro local apenas como fallback.
2. No modal, se o código inicial não existir na lista de responsáveis carregada do ERP, buscar esse código específico no ERP e adicioná-lo à lista, já selecionado (a lista atual filtra por natureza `EM/EF/ET`, então cadastros fora desse filtro nunca aparecem).
3. Manter os fallbacks já existentes (código sem zeros à esquerda e casamento por razão social).

Antes de codar o item 3, confirmo no ERP se o código 201340 realmente aparece na consulta de responsáveis; se aparecer, o problema é só o item 1 e a busca extra não é necessária.

## Detalhes técnicos

- `src/components/data-table/DataTable.tsx` / `useTablePrefs.ts`: suportar colunas fixadas no início (`pinnedFirst`) para que prefs salvas não empurrem "ID" para o fim.
- `DataTable.tsx` (`MobileCard`): não renderizar a coluna `acoes` (colunas com header vazio / flag `hideOnCard`) na lista de campos do card.
- `src/lib/erp-sync.server.ts` + migração no banco central: gravar `erp_carrier_code` na rota.
- `src/routes/_authenticated/rotas.index.tsx`: `initialCodErp` = `erp_carrier_code` da rota ?? cod_erp local.
- `src/lib/rota-erp.functions.ts`: nova função para buscar um responsável por código no ERP; `RouteEditDialog` usa como fallback de pré-seleção.
