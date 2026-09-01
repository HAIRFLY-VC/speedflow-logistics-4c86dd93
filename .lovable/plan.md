# Por que o "Tipo" fica vazio mesmo com fretista/transportadora identificado

## Situação

O selo "Tipo" só é preenchido quando a rota casa com um item da lista de responsáveis do ERP. Essa lista é montada por uma única consulta que **filtra apenas naturezas `EM`, `EF` e `ET`**. Se o responsável da rota (ex.: GUANABARA EXPRESS TRANSPORTE D) tiver outra natureza — ou não estiver nessa consulta — nenhum dos três caminhos de resolução encontra o registro:

1. código do responsável da rota no ERP (`COD_FRT_TRP`) → procurado na lista filtrada;
2. código da transportadora cadastrada localmente → procurado na mesma lista;
3. casamento por razão social → também dentro da mesma lista.

Ou seja: os três fallbacks dependem da mesma lista filtrada, então basta o responsável ficar fora dela para o campo mostrar "—". Uma segunda hipótese possível é a consulta em lote dos códigos por rota falhar silenciosamente (o erro hoje não aparece na tela).

Tentei confirmar consultando o ERP daqui, mas a API não respondeu a partir deste ambiente (erro 502), então a causa acima está fundamentada no código, não observada no ERP. Por isso o primeiro passo do plano é confirmar qual das duas hipóteses ocorre.

## Plano

1. **Diagnóstico visível na tela (temporário e discreto)**: exibir no campo "Tipo" estados distintos — carregando, erro na consulta do ERP, e "não identificado (código X)" com o código realmente lido do ERP no `title`. Isso mostra em um print se o código chegou e não casou, ou se a consulta falhou.
2. **Correção provável — deixar de depender do filtro de natureza**: buscar a natureza do responsável **pelo código exato da rota**, e não só dentro da lista filtrada. Nova consulta que, para os códigos das rotas exibidos, retorna código + razão social + natureza sem restringir a natureza; o mapeamento passa a ser `EF → F`, `ET → T`, `EM → P`, e qualquer outra natureza recebe um selo neutro com a sigla real no tooltip em vez de "—".
3. **Manter os fallbacks atuais** (código local e razão social) apenas como último recurso.
4. Depois de aplicado, validar com a rota 332 do print.

## Detalhes técnicos

- `src/lib/rota-erp.functions.ts`: nova server fn `listarNaturezasPorCodigoErp({ cods: string[] })` executando `select T.DBA_TIP_CODIGO_1 COD, TRIM(T.DBA_TIP_RAZAO_SOCIAL) RZ, T.DBA_TIP_NATUREZA NAT from gks.a_cadctipo T where T.DBA_TIP_CODIGO_1 in (...)` (sem filtro de natureza), devolvendo `Record<cod, { razaoSocial, natureza, tipoFrete }>`.
- `src/routes/_authenticated/rotas.index.tsx`:
  - nova `useQuery(["naturezas-erp", cods])` alimentada pelos códigos vindos de `listarResponsaveisDeRotasErp`;
  - `responsavelPorRota` passa a consultar primeiro esse mapa por código exato/normalizado;
  - coluna `tipo_frete` renderiza "…" enquanto `codsRotaQ`/naturezas carregam, "!" com tooltip do erro quando a consulta falha, e o selo com a sigla real quando a natureza não for EM/EF/ET.
- Nenhuma mudança de banco.
