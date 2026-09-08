# Maximizar a altura da planilha de Entregas em aberto

## Correção
- Trocar o cálculo atual, que reduz a planilha conforme a posição inicial dela na página, por uma altura máxima baseada no espaço entre o topo útil da tela e o totalizador fixo.
- Permitir que a parte superior da página role até o cabeçalho das colunas alcançar o limite logo abaixo da barra principal do app.
- Ao alcançar esse limite, manter o quadro da planilha nessa posição e usar a rolagem interna somente para as linhas, preservando o cabeçalho fixo.
- Fazer o quadro ocupar todo o espaço vertical restante até o totalizador, com uma pequena margem para evitar sobreposição.
- Recalcular as medidas ao redimensionar a janela, mudar a orientação e alterar a altura do totalizador.

## Comportamento esperado
- Na abertura, título, busca, resumo e ações continuam visíveis acima da planilha.
- Ao rolar a página, esses controles saem da área visível e o cabeçalho das colunas chega ao topo útil da tela.
- A planilha passa a exibir a maior quantidade possível de linhas até o rodapé, sem esconder o cabeçalho nem o totalizador.
- Depois desse ponto, a rolagem vertical percorre os dados dentro da planilha; a rolagem horizontal permanece disponível.

## Validação
- Conferir na resolução do exemplo, 1034 × 642, a posição inicial e a posição após a rolagem máxima da página.
- Confirmar que o cabeçalho chega logo abaixo da barra superior e permanece visível ao percorrer as linhas.
- Confirmar que a borda inferior da planilha termina acima do totalizador, sem espaço vazio excessivo ou sobreposição.
- Repetir a conferência em celular e após redimensionar a janela.

## Detalhe técnico
O cálculo atual usa `grid.getBoundingClientRect().top` como origem da altura. Isso faz o quadro caber exatamente no espaço disponível na posição inicial e elimina a extensão vertical necessária para a página levá-lo ao topo. A nova medida usará um ponto de encaixe estável no topo útil da tela e uma altura fixa para a área visível máxima; a posição atual servirá apenas para controlar o encaixe, não para diminuir o quadro.
