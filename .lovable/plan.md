# Ajustar automaticamente a altura do grid

## Alteração
- Substituir os descontos fixos de altura por um cálculo baseado no espaço realmente disponível na tela.
- Medir a posição atual do grid, a altura visível da janela e o espaço ocupado pelo totalizador inferior.
- Recalcular a altura ao abrir a tela, redimensionar a janela, mudar a orientação do celular e rolar a área principal.
- Fazer o grid crescer até próximo do totalizador, mantendo uma pequena margem visual.
- Preservar a rolagem interna vertical e horizontal e o cabeçalho fixo já corrigido.

## Comportamento esperado
- Em telas maiores, o grid aproveitará automaticamente a área vazia disponível.
- Em telas menores, a altura será reduzida sem esconder os títulos das colunas nem o totalizador.
- Ao rolar a página até o grid, ele poderá aumentar para aproveitar o novo espaço visível.

## Validação
- Conferir o resultado na resolução atual de 1034 × 642 e em uma resolução de celular.
- Rolar a página e depois as linhas do grid, confirmando que o cabeçalho continua fixo.
- Redimensionar a janela e confirmar que a altura se adapta sem sobreposição.
