# Mostrar o código do ERP ao lado do nome em "Fret / Transp"

## Situação

Hoje o card/tabela só acrescenta o código entre parênteses quando a rota tem transportadora
cadastrada localmente (`freight_carriers → transportadoras.cod_erp`). No exemplo da ID 368
(VITOR ALEXANDRE BARROS DE SOUZ) não existe esse cadastro local, então o nome aparece sem código —
mesmo o app já conhecendo o código do responsável vindo do ERP (o mesmo usado para definir o "Tipo" P).

## O que será feito

Passar a exibir sempre `NOME (CÓDIGO)` em "Fret / Transp" quando houver qualquer código conhecido,
na seguinte ordem:

1. código do responsável da rota lido no ERP (`COD_FRT_TRP`);
2. código da transportadora vinculada localmente;
3. sem código: mostra só o nome (comportamento atual).

Vale tanto para o card no celular quanto para a coluna na tabela do PC, e também para a ordenação/busca
(o texto usado no filtro passa a conter o código).

## Detalhes técnicos

- `src/routes/_authenticated/rotas.index.tsx`:
  - a coluna `motorista` passa a chamar `motoristaOf(r, codResponsavelPorRota.get(r.id) ?? transpPorRota.get(r.id)?.cod_erp)`
    tanto no `accessor` quanto no `render`;
  - `codResponsavelPorRota` já existe e é alimentado por `listarResponsaveisDeRotasErp`, então não há
    nova consulta ao ERP;
  - incluir `codResponsavelPorRota` nas dependências do `useMemo` das colunas.
- Nenhuma mudança de banco nem de backend.
