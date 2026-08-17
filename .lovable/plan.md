# Barra de rolagem lateral sempre visível na lista de CT-e

## Objetivo
Na tela de CT-e, a listagem deve exibir uma barra de rolagem vertical (lateral) permanente e ter o corpo da tabela rolável dentro de uma altura limitada, mantendo o cabeçalho fixo no topo.

## Alterações propostas

1. **Componente `DataTable`** (`src/components/data-table/DataTable.tsx`)
   - Envolver a `<Table>` em um contêiner com `overflow-y-scroll` (sempre visível) e altura máxima (`max-h`, por exemplo `max-h-[calc(100vh-280px)]` ou similar).
   - Manter o `<TableHeader>` fixo no topo durante a rolagem (`sticky top-0 z-10 bg-card`).
   - Adicionar uma prop opcional (ex: `scrollable?: boolean` ou `maxHeight?: string`) para ativar o comportamento apenas onde for desejado, evitando mudar todas as telas que usam o componente.

2. **Tela de CT-e** (`src/routes/_authenticated/ctes.index.tsx`)
   - Passar a prop para habilitar a rolagem fixa na lista de CT-e.

3. **Verificação visual**
   - Confirmar no preview que a barra de rolagem vertical permanece visível.
   - Confirmar que o cabeçalho da tabela fica fixo ao rolar o corpo.
   - Confirmar que a ação de clique na linha continua abrindo o detalhamento do CT-e.

## Notas técnicas
- Atualmente o `<main>` de `AppShell` já possui `overflow-auto`, então a página toda rola. A mudança fará com que apenas o corpo da tabela role, dentro do espaço disponível.
- A altura máxima deve considerar o header do AppShell (`h-14`), o título da página e os botões de ação, para ocupar o espaço restante sem cortar linhas.
- Em vez de `overflow-y-auto` (só aparece quando há conteúdo), usar `overflow-y-scroll` para manter a barra sempre visível.
