# Corrigir cabeçalho fixo em Entregas em aberto

## Alteração
- Manter o quadro externo como o único contêiner de rolagem horizontal e vertical.
- Desativar, somente nesta tabela, o contêiner interno de rolagem criado pelo componente compartilhado.
- Fixar a linha completa do cabeçalho no topo do quadro, com fundo opaco, borda e camada acima das linhas.
- Preservar filtros, ordenação, larguras das colunas e rolagem horizontal.

## Validação
- Abrir “Entregas em aberto” e rolar dentro do quadro até o meio e o final da lista.
- Confirmar visualmente que todos os títulos e botões de filtro permanecem exibidos.
- Conferir que a tabela continua rolando horizontalmente e que não há erros na tela.

## Detalhe técnico
O componente de tabela adiciona um `overflow-x-auto` próprio dentro do quadro vertical. Esse contêiner intermediário passa a ser a referência do `position: sticky`, embora não seja ele que rola verticalmente. A correção fará o `sticky` usar o quadro externo como referência.
