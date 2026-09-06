# Sync ERP manual ainda falha com erro 502

## O que está acontecendo (confirmado)

O botão **Sync ERP** ainda estoura o tempo limite da requisição. Nas duas tentativas de hoje (23:18 e 23:19) o servidor devolveu erro **502 exatamente 49–51 segundos** após o início — esse é o limite do canal entre o app e o servidor na pré-visualização. As duas execuções ficaram registradas como "em andamento" com 0 pedidos.

A sincronização **automática** (a cada 15 min) está funcionando: as três últimas rodaram com sucesso, 140 pedidos cada, mas levando **47 a 83 segundos**. Ou seja, o processo em si funciona; ele só é lento demais para caber nos ~50 s que o botão manual tem.

Medi cada etapa a partir do servidor da pré-visualização:

- Consulta de pedidos no ERP: ~5 s (140 pedidos)
- Consulta de responsáveis no ERP: ~6 s, retornando **10.000 linhas** (limite atingido, a lista está truncada) — e depois grava as 10.000 no banco a cada sincronização
- Cada ida ao banco central: **0,2 a 0,5 s**
- Etapa de rotas: ainda é feita **rota por rota** (26 rotas hoje), com 3 consultas + 1 gravação cada = ~100 idas ao banco em sequência ≈ **30–40 s sozinha**

Somando: ERP (~11 s) + gravação de responsáveis (10 mil linhas) + rotas (~35 s) + demais etapas ⇒ passa dos 50 s.

## O que vou fazer

**1. Etapa de rotas em lote (maior ganho)**
- Buscar de uma vez todas as rotas já existentes (por código do ERP e por código interno), em vez de 3 consultas por rota.
- Resolver transportadora/fretista de todas as rotas em uma única consulta.
- Inserir todas as rotas novas em uma única gravação e atualizar as reencontradas em lote.
- Resultado esperado: ~100 idas ao banco viram ~6.

**2. Responsáveis do ERP mais leves**
- Rodar a consulta de responsáveis **em paralelo** com a de pedidos (economiza ~6 s).
- Gravar no espelho apenas o que mudou desde a última sincronização, ou no máximo uma vez por hora — hoje regrava 10 mil linhas a cada rodada.
- Subir o limite da consulta para não truncar a lista de responsáveis.

**3. Proteção contra o tempo limite**
- Ao iniciar, fechar automaticamente execuções anteriores presas em "em andamento" há mais de 10 minutos.
- Marcar o tempo decorrido e, se passar de ~35 s, pular etapas opcionais (responsáveis, geocodificação) e fechar a execução com aviso, para nunca mais devolver 502 sem registrar nada.

**4. Botão Sync ERP tolerante a falha de rede**
- Se a resposta não chegar (502), o botão passa a consultar o histórico por até 2 minutos e mostra o resultado real da execução em vez de "Falha ao importar".

## Verificação

- Disparar o Sync ERP manual e conferir: resposta em menos de ~25 s, execução "concluída" no histórico com contagem de pedidos e rotas.
- Confirmar que a execução automática seguinte continua com sucesso e mais rápida.

## Detalhes técnicos

- `src/lib/erp-sync.server.ts`
  - Substituir o laço `for (const g of groups.values())` (consultas `routes` por `erp_route_id`/`code` + `resolveCarrierId` individuais) por: um `select` em `routes` com `.or(erp_route_id.in.(...),code.in.(...))`, um `select` em `transportadoras` com `.in("cod_erp", codes)` + um em `freight_carriers` com `.in("transportadora_id", ids)` (criando os fretistas ausentes em um único `insert`), um `insert` em lote das rotas novas com `.select("id,code,erp_route_id")` e `update`s apenas para rotas reencontradas (normalmente poucas).
  - `Promise.all([fetchPendingOrdersFromErp(), sincronizarEspelhoResponsaveis()])`; no espelho de responsáveis, comparar com o `max(atualizado_em)` e só regravar se passou 1 h (ou gravar somente diferenças); subir `limit` de 10000 para 50000.
  - No início de `syncErpOrders`: `update erp_sync_runs set status='failed', finished_at=now() where status='running' and started_at < now() - interval '10 minutes'`.
  - Orçamento de tempo (`Date.now()` inicial, limite ~35 s) para pular etapas opcionais e fechar a execução.
- `src/components/layout/ErpSyncButton.tsx`: no `onError`, se a mensagem indicar falha de rede/502, fazer polling em `erp_sync_runs` (última execução iniciada após o clique) por até 120 s, exibindo o resultado quando `finished_at` for preenchido.
- Sem alteração de schema.
