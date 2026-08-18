# Plano: limitar tabela de auditoria aos valores do CT-e atual

## Contexto

Na tela de detalhamento de um CT-e (`/ctes/:cteId`), a seção "Auditoria da cobrança" exibe o detalhamento completo da auditoria do grupo, incluindo componentes de CT-es complementares/reentrega vinculados (ex.: `FRETE VALOR (COMPL. CT-E 16238)`). Isso confunde a visualização porque o usuário quer ver apenas os valores do CT-e em questão.

## Objetivo

Exibir na tabela de detalhamento somente os componentes que pertencem ao CT-e atualmente visualizado. Os totais do cabeçalho (Esperado/Cobrado/Diferença) continuam refletindo a auditoria conjunta, e a tabela passa a mostrar apenas a parcela do CT-e selecionado.

## Passos

1. **Enriquecer o detalhamento da auditoria com origem**
   - Arquivo: `src/lib/cte-audit.server.ts`
   - Adicionar o campo `cte_id` (string) em cada item do `detalhamento` para identificar o CT-e de origem do componente.
   - Para componentes do CT-e original, usar `cte.id`.
   - Para componentes de complementos, usar o id do respectivo CT-e complementar.

2. **Filtrar a tabela na UI pelo CT-e atual**
   - Arquivo: `src/components/ctes/CteDetailView.tsx`
   - Ao renderizar as linhas do detalhamento, exibir apenas as linhas cujo `cte_id` corresponda a `cte.id`.
   - Linhas sem `cte_id` (dados antigos) continuam sendo exibidas como fallback, para não ocultar dados existentes antes de uma nova auditoria.

3. **Ajustar o rodapé da tabela**
   - Recalcular os totais do rodapé a partir apenas das linhas exibidas na tabela, mantendo a consistência visual.

4. **Adicionar indicação de auditoria conjunta**
   - Quando o CT-e possui complementos vinculados, exibir uma nota explicativa abaixo do cabeçalho de resumo informando que os totais consideram o CT-e original + complementos, mas a tabela mostra apenas o CT-e atual.

## Fora de escopo

- Não alterar a lógica de cálculo da auditoria (a auditoria continua conjunta para o grupo de CT-es).
- Não forçar reauditoria automática dos dados existentes.
- Não alterar a tela de listagem `Auditoria de fretes` neste plano.
