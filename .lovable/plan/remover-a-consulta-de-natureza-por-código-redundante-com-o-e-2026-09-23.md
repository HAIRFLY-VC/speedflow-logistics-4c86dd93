# Remover a consulta de natureza por código (redundante com o espelho local)

## Contexto

Hoje, ao abrir as telas de rotas, o app executa no ERP:

```sql
select T.DBA_TIP_CODIGO_1 COD, TRIM(T.DBA_TIP_RAZAO_SOCIAL) RZ, T.DBA_TIP_NATUREZA NAT
  from gks.a_cadctipo T
 where TRIM(T.DBA_TIP_CODIGO_1) in (...)
```

para cada código de responsável das rotas. Esses mesmos dados (código, razão social, natureza) já são mantidos no espelho local `erp_responsaveis`, alimentado pela sincronização horária (`WHERE DBA_TIP_NATUREZA IN ('ET','EF','EM')`) e pela sincronização automática de códigos ausentes (quando aparece um código fora desse filtro, a tela já o busca no ERP e grava no espelho). A consulta extra é redundante e será removida.

## O que muda

1. **Tela de rotas (RotasView):** a coluna Fret / Transp e o tipo de frete passam a ser resolvidos **somente** com o espelho local de responsáveis (razão social, natureza e tipo de frete já gravados), sem consultar o ERP por código.
2. **Detalhe da rota (`useResponsavelRota`):** mesmo ajuste — o bloco "Responsável pelo frete" usa apenas o espelho local.
3. **Códigos novos continuam cobertos:** o fluxo já existente que detecta códigos ausentes no espelho e os sincroniza em segundo plano (`sincronizarResponsaveisPorCodigo`) permanece. Quando um código novo aparece, ele é gravado no espelho e a tela resolve o nome/tipo logo em seguida.
4. **Remover a função** `listarNaturezasPorCodigoErp` (ela só era usada nesses dois pontos).

## Comportamento preservado

- A consulta do código do responsável por rota (`a_ger_rotas`, COD_FRT_TRP) **continua** — o usuário pediu para mantê-la, pois o responsável pode ser trocado no ERP a qualquer momento.
- Selos F / Transportadora / Frota própria, regra de edição (só fretista digita) e estimativa de frete seguem funcionando com os dados do espelho.
- Nenhuma alteração de banco de dados.

## Detalhes técnicos

- `src/components/routes/RotasView.tsx`: remover `naturezasQ`/`listarNaturezas` e os fallbacks que leem `naturezasQ.data`; `naturezaDaRota`/`tipoFreteOf` passam a derivar do espelho local (`responsaveisLocaisQ` + `responsaveisQ`).
- `src/lib/rota-responsavel.ts`: remover `naturezaQ` e o ramo que consulta natureza por código; o responsável vem do espelho local (`locaisQ`).
- `src/lib/rota-erp.functions.ts`: remover a função `listarNaturezasPorCodigoErp` e o tipo `NaturezaErp` se ficar sem uso.
