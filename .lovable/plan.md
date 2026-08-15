# Volumes e peso bruto das NF-es do CT-e

Ao importar um CT-e normal, o app passa a buscar o XML de cada nota fiscal referenciada e a guardar **quantidade de volumes** e **peso bruto** de cada uma, exibindo esses dados no detalhamento do CT-e.

## Como vai funcionar

1. Quando um CT-e normal é importado (robô ou upload manual), o app percorre as chaves das NF-es referenciadas.
2. Para cada nota que ainda não está no app, é criada automaticamente uma solicitação de download para o robô (mesmo fluxo já usado hoje para NF-e).
3. Quando o robô entrega o XML, o app lê e grava:
   - quantidade de volumes (campo `qVol` do XML)
   - peso bruto (campo `pesoB`, já lido hoje, mas hoje não aparece no CT-e)
   - também guardo peso líquido e espécie dos volumes, que vêm no mesmo bloco e são úteis na conferência.
4. No detalhamento do CT-e, a lista de notas fiscais passa a mostrar, por nota: número, volumes e peso bruto — com uma linha de **totais** (soma de volumes e de peso bruto) e comparação com o peso taxado do CT-e.
5. Notas ainda não baixadas aparecem como "aguardando XML", com botão para solicitar/reprocessar; assim que o robô entrega, os dados aparecem.

Notas fiscais de CT-e complementar continuam sendo mostradas como hoje (o complementar herda as notas do original); a coleta de volumes/peso acontece a partir do CT-e normal.

## Detalhes técnicos

- **Banco central (`speedflow.nfes`)**: novas colunas `volumes` (numeric), `peso_liquido` (numeric) e `especie_volumes` (text). Aplicadas no banco central e espelhadas no schema local apenas para manter a tipagem gerada.
- **`src/lib/nfe-parse.server.ts`**: extrair `qVol`, `pesoL` e `esp` do bloco `<vol>` (somando quando houver mais de um `<vol>`).
- **`src/lib/nfe-ingest.server.ts`** e `uploadNfeXml` em `src/lib/nfe.functions.ts`: gravar os novos campos.
- **`src/lib/cte-ingest.server.ts`**: após criar o CT-e (apenas `tipo_cte = 0`), inserir em `nfe_solicitacoes` as chaves de 44 dígitos de `nfs_referenciadas` que ainda não existem em `nfes` nem em solicitações pendentes/processando.
- **`src/lib/cte.functions.ts` (nova função `getNfesDoCte`)**: consulta `nfes` e `nfe_solicitacoes` pelas chaves do CT-e e devolve, por chave, número, volumes, peso bruto e status do download.
- **`src/components/ctes/CteDetailView.tsx`**: a seção de notas fiscais passa a usar essa consulta, exibindo colunas Volumes e Peso bruto, linha de totais e o comparativo com o peso taxado; nada muda no cálculo da auditoria.
- **Backfill**: rodo uma vez o processo para os CT-es normais já importados, criando as solicitações das notas ainda ausentes.
