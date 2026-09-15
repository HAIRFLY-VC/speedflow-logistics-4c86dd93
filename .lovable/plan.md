# Corrigir o card "Em separação agora"

## O que foi verificado no ERP (agora)

Consultando o ERP diretamente (`GKS.A_SEPPEDIDO`, desde 01/01/2025):

- Pedidos sem fim de separação: **3** — todos com situação "P", incluídos hoje entre 15:20 e 15:38.
- Desses 3, **nenhum** tem início de separação preenchido.
- Ou seja, hoje o correto é: **Na fila = 3** e **Em separação agora = 0**.

O número 58 do print não vem do ERP: 58 é exatamente a contagem de registros sem conferência da cópia antiga da separação, usada antes da mudança de origem. A causa mais provável é o painel exibindo um resultado antigo guardado no navegador, mas isso não está confirmado — por isso o primeiro passo é confirmar a origem antes de mudar a regra.

## O que vou fazer

1. Confirmar a origem: registrar/consultar o que a leitura do ERP devolve ao abrir a tela (quantidade de pedidos em aberto, com e sem início) e comparar com os 3 do ERP.
2. Tornar a regra do card explícita e à prova de dado estranho: "Em separação agora" conta apenas pedidos com **início preenchido e fim de separação vazio**; datas vazias ou inválidas contam como não preenchidas. "Na fila" conta os que não têm início.
3. Eliminar duplicidade: se o mesmo pedido vier nas duas leituras (período e em aberto), considerá-lo uma única vez.
4. Garantir dados frescos ao abrir: o painel não reaproveita resultado antigo guardado; o botão Atualizar continua forçando nova leitura.
5. Conferir ao final: card "Em separação agora" em 0 e "Na fila" em 3 (ou o que o ERP indicar no momento), com a lista de pedidos em aberto batendo com o ERP.

## Detalhes técnicos

- `src/lib/separacao.functions.ts`: manter as duas consultas (concluídos no período e `dt_fim_sep is null`); deduplicar por `cod_pedido` no retorno e normalizar strings vazias de data para `null` em `mapear`.
- `src/routes/_authenticated/separacao.tsx`: `fila`/`andamento` passam a usar um helper `temData()` em vez de teste de verdade direto; `useQuery` com `gcTime` curto/`refetchOnMount: "always"` para não pintar resultado antigo enquanto revalida.
- Verificação: comparar os cards com `select count(*) ... where dt_fim_sep is null` no ERP.
