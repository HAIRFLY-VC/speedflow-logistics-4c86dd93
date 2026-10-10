# Acelerar Custo de Frete com muitos ciclos (v1.39.1 — PATCH)

## Problema
Hoje cada ciclo é carregado um após o outro, e dentro de cada ciclo todas as consultas (páginas de notas, pedidos, rotas, clientes, provisões) também rodam uma de cada vez. Com 2 ciclos levou ~60 s; com muitos ciclos o tempo cresce proporcionalmente.

## O que muda
1. **Ciclos em paralelo e com cache por ciclo**: cada ciclo vira um item de cache próprio. Ao marcar/desmarcar ciclos, só os novos são buscados; os já carregados aparecem na hora (cache de 5 min, mantido por 30 min).
2. **Uma consulta para o intervalo inteiro**: ciclos contíguos são lidos numa única faixa de datas e depois separados, evitando repetir pedidos/rotas/clientes por ciclo.
3. **Consultas em paralelo limitado**: páginas de notas e lotes (pedidos, rotas, clientes, provisões) rodam ~6 de cada vez em vez de uma por vez; lotes maiores (150 → 300 códigos).
4. **Colunas só necessárias**: Mercadorias faturadas deixa de pedir "todas as colunas" e busca apenas as usadas.
5. **Carregamento visível**: indicador "carregando X de Y ciclos" enquanto busca, mantendo os dados anteriores na tela em vez de esvaziá-la.

Regras de negócio inalteradas: agendas 417/427, frete real/provisionado, consolidação de reentregas entre ciclos marcados, totais iguais entre Dashboard e Mercadorias faturadas.

## Riscos
Nenhuma mudança no banco, flags ou integrações. Mais consultas simultâneas ao banco central (limitadas a ~6).

## Detalhes técnicos
- `src/lib/custo-frete.query.ts`: `emLotes` com concorrência limitada (pool de 6); paginação de notas: primeira página com `count: "exact"` e demais páginas em paralelo; `custoFreteMultiQueryOptions`/mercadorias multi passam a usar `useQueries` com `custoFreteQueryOptions` por ciclo (`placeholderData: keepPreviousData`), consolidando reentregas após juntar.
- `select("*")` substituído pela lista explícita de colunas já mapeadas.
- Telas `custo-frete.tsx` e `custo-frete-mercadorias.tsx`: progresso por ciclo.
- Versão 1.39.1 + CHANGELOG.

## Checklist para publicar
- Testar 1, 2 e 6+ ciclos; conferir totais iguais entre as duas telas e com a versão anterior.
- Sem migrações/flags. Reverter: voltar para v1.39.0 no histórico.
