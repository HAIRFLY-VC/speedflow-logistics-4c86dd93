# Unificar critério de custo de frete entre as duas telas

## Problema

A tela **Custo de Frete** mostra R$ 3.826,02 (2,13%) no ciclo out/26, enquanto a tela **Mercadorias faturadas** do mesmo ciclo mostra R$ 4.241,73 (2,36%). As duas deveriam somar o mesmo valor.

A divergência vem do critério: cada tela calcula o frete de um jeito diferente.

- **Mercadorias faturadas** soma, por nota faturada, o `vlr_frete` real do ERP e, quando a nota ainda não tem frete real, usa o valor **provisionado** da tabela de frete da transportadora. É o critério oficial pedido anteriormente (R = real, P = provisionado).
- **Custo de Frete** ignora `vlr_frete` e provisão: pega o `total_freight` da rota confirmada e rateia por valor dos pedidos. Rotas sem `frete_confirmado_em` entram como zero, e provisão nunca entra.

Resultado: notas com frete real já lançado no ERP mas sem rota confirmada no app, e notas cobertas só por provisão, somem do total de Custo de Frete.

## O que muda

A tela **Custo de Frete** passa a usar exatamente a mesma base da tela **Mercadorias faturadas**:

- Soma `vlr_frete` real por nota (quando existe no ERP).
- Para notas sem frete real, usa o valor provisionado (soma dos seis componentes: frete, perna, diária, pernoite, reentrega, descarrego — mesmo critério já aplicado em Mercadorias faturadas).
- Rota, responsável e tipo continuam vindo da rota vinculada quando houver.
- Indicador "Pedidos sem frete confirmado" passa a significar "pedidos sem frete real nem provisionado".
- Evolução dos últimos 6 ciclos usa o mesmo critério, então set/26 e ago/26 vão subir junto.

Depois disso, os dois totais passam a bater: o card "Frete confirmado" da tela Custo de Frete deve mostrar o mesmo valor do card "Vlr. Frete" da tela Mercadorias faturadas, no mesmo ciclo.

## Técnico

- `src/lib/custo-frete.query.ts` → reescrever `carregarCustoFrete` para reaproveitar `carregarMercadorias` + `aplicarProvisoes` (a mesma função que a tela Mercadorias já usa), agregando por NF. Manter a assinatura `LinhaCustoFrete` e os campos usados pela tabela de fretistas/transportadoras; manter rota/responsável/tipo via `routes` + `erp_responsaveis` como hoje.
- `resumir` continua igual (soma `l.frete`). "Sem frete" vira "sem R nem P".
- `src/routes/_authenticated/custo-frete.tsx` → só ajustar o texto do card "Pedidos sem frete confirmado" para "Pedidos sem frete (real ou provisionado)" e o subtítulo da página.
- Sem migração de banco, sem flag. Versão **1.37.0** (MINOR, muda critério visível).

## Checklist para publicar

- Abrir `/custo-frete` no preview, ciclo out/26, e conferir que "Frete confirmado" = "Vlr. Frete" de `/custo-frete/mercadorias` (hoje R$ 4.241,73).
- Conferir ciclos anteriores (set/26, ago/26) na evolução — devem subir junto.
- Sem migração. Sem flag.
- Reversão: voltar para v1.36.1.
