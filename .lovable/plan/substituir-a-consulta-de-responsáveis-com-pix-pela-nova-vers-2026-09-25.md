# Substituir a consulta de responsáveis com PIX pela nova versão

## Objetivo

Trocar a consulta que busca os responsáveis (fretista / transportadora / frota própria) com PIX
pela versão fornecida, que muda a forma de localizar o PIX no ERP:

- **Antes:** procurava o contato cujo **nome** era "PIX" e usava o campo de e-mail como chave.
- **Agora:** procura o contato cujo **cargo** é "PIX" e usa como chave o nome do contato; se o
  nome estiver em branco, usa o e-mail.

Isso vale para a sincronização completa (Sync ERP e botão "Atualizar cadastro") e para a
sincronização pontual por código. Nada muda nas telas — o PIX continua aparecendo nos mesmos
lugares, apenas com a nova fonte de dados.

## Nova consulta (a ser gravada no código)

```sql
SELECT TRIM(T.DBA_TIP_CODIGO_1) COD_ERP,
       TRIM(T.DBA_TIP_RAZAO_SOCIAL) RAZAO_SOCIAL,
       T.DBA_TIP_NATUREZA COD_NAT,
       (SELECT MAX(CASE WHEN C.DBA_CONT_CONTATO <> '                            '
                        THEN TRIM(C.DBA_CONT_CONTATO)
                        ELSE TRIM(C.DBA_CONT_EMAIL) END)
          FROM GKS.A_CADCCONT C
         WHERE C.DBA_CONT_CODIGO = T.DBA_TIP_CODIGO_1
           AND C.DBA_CONT_CARGO = 'PIX                                                         ') PIX
  FROM GKS.A_CADCTIPO T
 WHERE T.DBA_TIP_NATUREZA IN ('ET','EF','EM')
```

Observação: os literais com espaços fixos (`'PIX...'` no cargo e o contato em branco) serão
escritos com `RPAD(...)`/comparação tolerante a espaços no código, para não depender de contar
espaços manualmente — mesma seleção, sem risco de erro de digitação.

## Detalhes técnicos

- `src/lib/rota-erp.functions.ts`:
  - substituir `SQL_CADASTRO_RESPONSAVEIS` (linha ~9);
  - substituir a consulta em lotes de `sincronizarResponsaveisPorCodigo` (linha ~279), mantendo o
    filtro `TRIM(T.DBA_TIP_CODIGO_1) in (...)` e trocando apenas o subselect do PIX.
- `src/lib/erp-sync.server.ts`: substituir `RESPONSAVEIS_SQL` (linha ~298) pela mesma consulta.
- Nenhuma mudança de tipagem, telas ou banco: o campo `PIX` continua chegando com o mesmo nome.
- Verificação: `bunx tsgo --noEmit`, build e uma sincronização ("Atualizar cadastro" na tela de
  Transportadoras) para conferir se o PIX continua sendo gravado.
