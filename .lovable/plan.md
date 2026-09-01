# Corrigir o campo "Tipo" no card da rota

## Problemas observados

1. **Posição errada**: no celular, "Tipo" aparece no fim do card, depois de "Frete" e "% Frete", em vez de logo abaixo de "Fret / Transp". Isso acontece porque a ordem de colunas salva pelo usuário não conhece a coluna nova, e colunas novas entram no fim da lista.
2. **Tipo vazio ("—")**: hoje o tipo é deduzido a partir do cadastro local de transportadoras (código ERP) ou por comparação de nome. Quando a rota não tem transportadora cadastrada localmente (o card mostra o nome sem o código entre parênteses, como no exemplo da GUANABARA EXPRESS), não há código para casar e o tipo fica indefinido.

## O que será feito

1. **Tipo sempre imediatamente após "Fret / Transp"**, tanto no card (celular) quanto na tabela (PC), ignorando a ordem de colunas salva anteriormente.
2. **Identificar o tipo pelo responsável realmente selecionado na rota**: buscar no ERP o código do responsável (o mesmo dado que a tela de edição já usa para pré-selecionar) para todas as rotas listadas de uma vez, e usar esse código para determinar F / T / P.
   - Ordem de resolução: código do responsável vindo do ERP → código da transportadora cadastrada localmente → casamento por razão social (fallback atual).
   - Enquanto a consulta carrega, o campo mostra "—" e passa a exibir o selo assim que os dados chegam.
3. O cálculo do frete continua igual: editável só para **F**, estimativa para **T** com tabela vigente, somente leitura para **P**.

## Detalhes técnicos

- `src/lib/rota-erp.functions.ts`: nova função `listarResponsaveisDeRotasErp({ idsRota: number[] })` executando `select R.ID, R.COD_FRT_TRP from gks.a_ger_rotas R where R.ID in (...)` em uma única chamada, devolvendo `Record<idRota, codErp>`.
- `src/routes/_authenticated/rotas.index.tsx`:
  - nova `useQuery(["rotas-responsaveis-erp", ids])` alimentada pelos `erp_route_id` das rotas carregadas (staleTime curto), com `enabled` quando houver ids.
  - `responsavelPorRota` passa a priorizar o código vindo dessa query (normalizado por `normalizaCod`) antes dos fallbacks existentes.
  - coluna `tipo_frete` ganha `pinAfter: "motorista"` (ou equivalente) para ficar fixa após a coluna de fretista/transportadora.
- `src/components/data-table/types.ts` + `useTablePrefs.ts` + `DataTable.tsx`: suportar `pinAfter` (posicionamento fixo relativo a outra coluna), no mesmo estilo do `pinFirst` já existente, aplicado tanto na tabela quanto no `MobileCard`.
