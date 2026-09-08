# Cabeçalho fixo na tabela de Entregas em aberto

## Objetivo
Na tela **Entregas em aberto**, o cabeçalho da planilha deve acompanhar a rolagem até o topo da área visível e, a partir daí, permanecer fixo enquanto apenas o corpo da tabela continua rolando. Ou seja, comportamento *sticky* para os títulos das colunas.

## Alterações propostas

### 1. Tabela da tela `entregas-abertas.tsx`
- Aplicar `sticky top-0 z-10 bg-card` no `<TableHead>` de cada coluna.
- Garantir fundo sólido no cabeçalho (`bg-card`) para não ficar transparente sobre as linhas durante a rolagem.
- Manter o wrapper `overflow-x-auto` para a rolagem horizontal da planilha.
- Adicionar `relative` no contêiner da tabela, se necessário, para manter o contexto de posicionamento.

### 2. Componente `DataTable` (uso futuro)
- Revisar o `TableHead` já existente no `DataTable.tsx`: ele já possui `sticky top-0 z-10 bg-card` quando a prop `scrollable` é usada. Verificar se o comportamento está consistente e, se a tabela de entregas abertas passar a usar o `DataTable`, aproveitar a mesma lógica.

## Validação
- Confirmar no preview que, ao rolar a página para baixo, o cabeçalho da planilha gruda no topo da área de conteúdo.
- Confirmar que a rolagem horizontal continua funcionando.
- Confirmar que o rodapé fixo com totais não sobrepoem o cabeçalho.
