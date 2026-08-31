# Card da rota com ID e edição em destaque

## O que muda na listagem de rotas

- **ID no início do card**: o card passa a começar por uma linha de cabeçalho com o ID da rota no ERP (`ID 332`), em destaque, antes da data. Rotas criadas manualmente (sem ID no ERP) mostram apenas a data.
- **Ícone de edição no canto superior direito**: o lápis sai do fim do card e passa a ficar alinhado ao ID, no topo à direita, com área de toque maior (botão de 40x40 px, ícone maior). Clicar nele não abre o detalhamento da rota.
- Na visualização de tabela (PC), a coluna de ações continua como está; ganha também uma coluna com o ID da rota no ERP.

## O que muda na tela "Editar rota"

- Exibir o **ID da rota** (ERP) no topo do modal, como informação somente leitura.
- **Nome da rota**: hoje o campo mostra o código interno (`erp-332`) em vez do nome exibido no card (`M- GBEX`). Passa a carregar o mesmo nome mostrado na listagem, e a gravação continua atualizando esse mesmo nome.
- **Remover o campo "Motorista / Responsável"** — a responsabilidade fica com o campo de transportadora/fretista. O nome enviado ao ERP passa a ser o da razão social selecionada (nulo quando nada estiver selecionado).
- **Transportadora / Fretista / Frota própria**: já abrir com a opção correspondente ao código da transportadora da rota pré-selecionada. Quando o código não casar exatamente, tenta casar ignorando zeros à esquerda/espaços e, em último caso, pela razão social já gravada na rota.

## Detalhes técnicos

- `src/components/data-table/DataTable.tsx`: nova prop opcional `cardHeaderAction?: (row) => ReactNode` usada pelo `MobileCard` para renderizar um slot no topo direito do card (flex com o título à esquerda), sem afetar a tabela desktop.
- `src/routes/_authenticated/rotas.index.tsx`:
  - nova coluna `erp_route_id` ("ID") e passagem de `cardHeaderAction` renderizando o botão de edição (`h-10 w-10`, ícone `h-5 w-5`, `stopPropagation`).
  - o objeto passado ao `RouteEditDialog` inclui `nomeRota: nomeRotaOf(r)` além de `code`/`notes`.
- `src/components/routes/RouteEditDialog.tsx`:
  - `EditableRoute` ganha `nomeRota`; o estado inicial do campo usa esse valor.
  - remoção do input de motorista; `nomeMotorista` passa a derivar do responsável selecionado.
  - pré-seleção: efeito que, ao carregar `listarResponsaveisErp`, resolve `codFrtTrp` comparando `codErp` normalizado (`trim` + remoção de zeros à esquerda) com o `initialCodErp`, com fallback por razão social vinda de `driver_name`.
  - persistência local mantém `code`/`notes` coerentes com o nome exibido na listagem.
