# Nome do vendedor no card "Vendedor" do Custo de Frete — v1.37.4 (PATCH)

## O que muda

No painel **Custo de Frete**, o card de dimensão **Vendedor** passa a exibir o nome do vendedor seguido do código entre parênteses, no mesmo padrão das demais telas:

`NOME DO VENDEDOR (5245)`

Quando o código não tiver nome correspondente no cadastro, mantém-se apenas o código. O Excel exportado pelo card acompanha automaticamente o mesmo rótulo.

## Detalhes técnicos

- O espelho local (`notas_faturadas` / `entregas_abertas`) só guarda `cod_vendedor`; o nome vem do cadastro de vendedores do banco central externo (`public.vendedores`, colunas `cod_rca` e `nome`).
- Reutilizar a server function existente `listVendedoresExternos` (`src/lib/external-catalog.functions.ts`) — sem nova consulta nem migração.
- `src/routes/_authenticated/custo-frete.tsx`:
  - Carregar os vendedores uma vez (`useServerFn(listVendedoresExternos)` + `useQuery`, cache por sessão) e montar um mapa `cod_rca → nome`.
  - Na dimensão "vendedor" (`DIMENSOES`), a chave passa a receber o mapa e retorna `${nome} (${cod_vendedor})` quando houver nome; caso contrário, só o código. Falha na busca de nomes não quebra o card (fallback: só código).
  - Exportação Excel do card já usa `g.nome`, então passa a sair com o novo rótulo sem mudanças extras.
- `src/config/version.ts`: 1.37.3 → 1.37.4.
- `CHANGELOG.md`: nova entrada no topo.

Sem migração, sem flags, sem risco para a versão publicada (somente leitura de nome para exibição).

## Checklist para publicar

- No preview, abrir Custo de Frete e conferir o card Vendedor: nomes com código entre parênteses; códigos sem nome ficam sozinhos.
- Exportar o Excel do card e conferir o rótulo.
- Reverter para a v1.37.3 no histórico, se necessário.
