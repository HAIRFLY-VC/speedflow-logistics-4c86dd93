# Tipo do responsável no card da rota e frete conforme o tipo

## O que muda

1. **Nova linha "Tipo" logo abaixo de "Fret / Transp"** em cada card/linha de rota, com um selo:
   - **F** — Fretista
   - **T** — Transportadora
   - **P** — Frota própria
   - **—** quando o responsável não estiver definido ou não for identificado no ERP.

2. **Campo "Frete (R$)" passa a depender do tipo:**
   - **F (fretista):** editável como hoje (usuário digita o valor a ser pago).
   - **T (transportadora):** não editável. Se a transportadora tiver tabela de frete vigente, o app exibe a **estimativa calculada** a partir dos pedidos associados à rota (mesmo cálculo já usado hoje, com o selo âmbar "est." e o tooltip da tabela utilizada). Sem tabela vigente, exibe "—".
   - **P (frota própria):** não editável, exibe o valor já gravado ou "—".
   - A coluna "% Frete" continua funcionando sobre o valor exibido (informado ou estimado).

## Como o tipo é obtido

O tipo já existe no ERP: a consulta de responsáveis (`gks.a_cadctipo`, campo `dba_tip_natureza`) devolve `EF → F`, `ET → T`, `EM → P`. A tela de rotas passa a carregar essa lista uma única vez (cacheada) e casa cada rota com o responsável por:
1. código ERP da transportadora já resolvida para a rota; senão
2. razão social / nome do responsável da rota (comparação normalizada, como já é feito hoje).

## Detalhes técnicos

- `src/routes/_authenticated/rotas.index.tsx`
  - Nova query `useQuery(["responsaveis-erp"])` chamando `listarResponsaveisErp` via `useServerFn` (staleTime longo, pois muda pouco).
  - Novo helper `tipoFreteOf(route)` → `"F" | "T" | "P" | null`, usando o mapa por `codErp` e o fallback por nome.
  - Nova coluna `tipo_frete` posicionada imediatamente após a coluna `motorista` ("Fret / Transp"), com selo colorido e `title` descritivo.
  - `FreightInput` recebe `tipo`; quando o tipo não é `F`, renderiza texto somente leitura (estimativa em âmbar para `T`, valor gravado ou "—" nos demais) em vez do `<input>`.
  - A estimativa continua vindo de `estimativas` (`simularRota` + `tabelaVigenteDaTransportadora`), sem mudança na lógica de cálculo.
- Nenhuma alteração de banco ou de backend é necessária.
