# Exibir o código do responsável também na rota 372

## O que está acontecendo

No card, "Fret / Transp" só mostra `NOME (CÓDIGO)` quando o responsável é encontrado
na lista de responsáveis do ERP ou no espelho local (`erp_responsaveis`).

Na rota 370 esse casamento acontece, então aparece `ALEXANDRE BARROS DE SOUZA (206091)`.

Na rota 372 o código do responsável existe (é ele que faz o selo "Tipo: P" aparecer,
pois esse selo vem da consulta de natureza feita por código no ERP), mas o cadastro
não está na lista/espelho usados para montar o texto. Sem isso, o card cai no
`driver_name` que veio do ERP — já truncado ("VITOR ALEXANDRE BARROS DE SOUZ") — e sem código.

## Correção

Usar a consulta de natureza por código (que já traz código + razão social e já
resolveu a rota 372) como mais uma fonte para o nome e o código exibidos:

1. Quando não houver responsável no espelho local nem na lista do ERP, montar o
   responsável a partir do resultado da consulta por código (nome completo do ERP + código).
2. Se ainda assim faltar o nome, exibir pelo menos `driver_name (código)`, para o
   código nunca sumir quando ele é conhecido.

Efeito: a rota 372 passa a exibir `VITOR ALEXANDRE BARROS DE SOUZA (código)`, com o
nome completo em vez do truncado, e o mesmo vale para qualquer rota cujo responsável
ainda não esteja no cadastro local.

## Detalhes técnicos

- `src/routes/_authenticated/rotas.index.tsx`:
  - em `responsavelPorRota`, após falhar o lookup por código no espelho/lista, usar
    `naturezasQ.data` (`listarNaturezasPorCodigoErp`) para criar o `ResponsavelErp`
    (razão social, código, tipo) antes do fallback por nome;
  - `motoristaOf`: quando não houver `responsavel`, ainda assim concatenar o código
    conhecido (`codResponsavelPorRota`) ao nome disponível.
- Sem mudanças de banco ou de backend.
