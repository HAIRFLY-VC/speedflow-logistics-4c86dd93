# Modal de edição de rota: melhor experiência no celular

## Problemas

1. O campo "Transportadora / Fretista / Frota própria" demora para exibir o nome: o modal abre e só depois de carregar a lista completa de responsáveis do ERP (até 5.000 registros) é que o nome aparece.
2. Depois que carrega, o texto longo (razão social + código + tipo) empurra o modal para além da largura da tela, criando rolagem horizontal.

## O que será feito

### 1. Carregamento mais rápido e com feedback
- Ao abrir o modal, mostrar imediatamente o código do responsável já conhecido da rota com um indicador "Carregando responsável..." em vez de "Selecione o responsável".
- Assim que o nome estiver disponível, ele substitui o texto de carregamento — o usuário nunca vê o campo aparentemente vazio.
- Manter o cache da lista entre aberturas (já existe), de forma que a segunda abertura seja instantânea.

### 2. Modal respeita a largura da tela
- O conteúdo do modal passa a ter largura máxima limitada à tela do celular, sem rolagem horizontal.
- O botão do seletor deixa de forçar uma linha única: o texto quebra em até 2–3 linhas (razão social numa linha, código e tipo abaixo), com o botão crescendo em altura em vez de largura.
- A lista suspensa de opções também fica limitada à largura do gatilho, com quebra de texto nos itens.
- Rodapé com botões em largura total empilhados no celular.

## Detalhes técnicos

- `src/components/routes/RouteEditDialog.tsx`:
  - `DialogContent`: `w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] sm:max-w-lg` + `overflow-x-hidden`, campos com `min-w-0`.
  - Botão combobox: remover `truncate`/linha única, usar `h-auto min-h-11 items-start text-left whitespace-normal break-words` com o texto em bloco (nome em cima, `código · tipo` embaixo).
  - Estado de carregamento: quando `responsaveisQ.isLoading` e existe código inicial, exibir `Carregando responsável (<código>)…`.
  - `PopoverContent`/`CommandItem`: `max-w-[calc(100vw-2rem)]`, itens com `whitespace-normal break-words`.
  - `DialogFooter`: botões `w-full sm:w-auto`.
- Nenhuma mudança em regra de negócio, consultas ao ERP ou banco.
