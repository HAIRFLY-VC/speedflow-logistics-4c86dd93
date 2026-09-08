# Reordenar colunas do painel "Entregas em aberto"

## Objetivo
Permitir que o usuário mude a ordem das colunas arrastando:
- diretamente o cabeçalho do grid (arrastar uma coluna e soltar sobre outra);
- os itens da lista do botão "Colunas" (arrastar pela alça ao lado de cada nome).

A nova ordem vale para o grid, para a exportação Excel e é salva no perfil do usuário, voltando igual na próxima visita.

## Como vai funcionar
1. A lista salva de colunas passa a guardar também a ordem escolhida (hoje ela guarda só quais estão visíveis, e a ordem é sempre a original).
2. No cabeçalho do grid: ao pressionar e arrastar um título, ele fica destacado e uma linha indica onde será solto. Ao soltar, a coluna assume a nova posição. O clique simples continua abrindo o filtro/ordenação normalmente (o arraste só inicia após pequeno deslocamento).
3. No painel "Colunas": cada item ganha uma alça de arrasto para reposicionar; marcar/desmarcar continua controlando a exibição. Colunas ocultas mantêm sua posição na ordem para quando forem reexibidas.
4. Botão "Colunas padrão" volta à ordem e visibilidade originais.
5. Visões de filtro salvas/compartilhadas passam a carregar também a ordem das colunas.

## Detalhes técnicos
- Arquivo principal: `src/routes/_authenticated/entregas-abertas.tsx`.
- `colunasVisiveis` (persistido via `useColumnFilterPrefs` → `user_table_preferences`) passa a ser tratado como lista ordenada: `visiveis` deixa de filtrar `colunas` na ordem de definição e passa a mapear a ordem salva; colunas novas não presentes na lista entram ao final se `padrao !== false`.
- Guardar também a ordem completa (incluindo ocultas) num campo adicional da preferência (ex.: `columnOrder`), para preservar posição de colunas desmarcadas; fallback para a ordem de definição quando ausente.
- Drag & drop com HTML5 nativo (`draggable`, `onDragStart/onDragOver/onDrop`) — sem nova dependência — no `TableHead` e nos itens do popover; suporte a toque via `onPointerDown` na alça no popover.
- Persistência usa o mesmo debounce já existente; `aplicarConjunto` e o salvamento de visões incluem a ordem.
- Exportação Excel e filtros/ordenacão já derivam de `visiveis`, portanto seguem a nova ordem automaticamente.

## Verificação
- Typecheck, build e carregamento da rota `/entregas-abertas`.
- Teste no navegador: reordenar pelo cabeçalho, reordenar pelo popover, recarregar a página e confirmar que a ordem persiste; conferir a ordem no arquivo exportado.
