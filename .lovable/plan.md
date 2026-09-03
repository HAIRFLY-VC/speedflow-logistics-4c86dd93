# Voltar a exibir nome e cidade do cliente

## Problema confirmado

Ao remover a tabela de clientes do banco central, o app perdeu duas informações que ainda existem no ERP:

- **Nome do cliente**: pedidos, kanban, detalhe do pedido e paradas da rota mostram só `Cliente 12345`.
- **Cidade de entrega**: a estimativa de frete das rotas de transportadora usa a praça (município) para achar a linha da tabela de preço. Como o município vem sempre vazio, nenhuma rota "T" mostra valor estimado.

A sincronização com o ERP já traz `CLIENTE_RS` (razão social) e `CIDADE` na consulta de pedidos, mas hoje esses campos são descartados.

## Solução

1. **Nova tabela espelho `clientes_erp`** no banco central: código do cliente (chave), razão social, nome de nota, bairro, cidade, UF e data da última atualização.
2. **Sync ERP** passa a gravar/atualizar esse espelho a cada rodada, usando os campos que já vêm da consulta.
3. **Telas** leem o espelho e exibem o nome do cliente, com queda para `Cliente {código}` quando o código ainda não estiver espelhado:
   - lista de pedidos (coluna Cliente, busca e ordenação por nome),
   - kanban (cartão do pedido),
   - detalhe do pedido (nome + cidade/UF),
   - detalhe da rota (lista de paradas e balões do mapa).
4. **Estimativa de frete** na lista de rotas passa a usar a cidade do espelho como município da entrega, restaurando o cálculo por praça.

## Detalhes técnicos

- `db/central/<data>_clientes_erp.sql`: `create table if not exists speedflow.clientes_erp (cod_cliente text primary key, razao_social text, nome_nf text, bairro text, cidade text, uf text, atualizado_em timestamptz not null default now())`, índice por `cidade`, `GRANT SELECT, INSERT, UPDATE, DELETE ... TO service_role` e `GRANT SELECT ... TO authenticated`. Aplicado pelo caminho REST usado nos demais scripts centrais.
- `src/integrations/central/types.ts`: tipo `ClienteErpRow` + entrada `clientes_erp` em `CentralDatabase`.
- `src/lib/erp-sync.server.ts`: upsert em lote de `clientes_erp` a partir de `COD_CLIENTE/CLIENTE_RS/CLIENTE_NF/BAIRRO/CIDADE/UF` na mesma passagem que já processa os pedidos.
- Novo hook/consulta compartilhada (`["clientes-erp"]`, staleTime alto) lendo `cod_cliente,razao_social,nome_nf,cidade,uf`, usada por `pedidos.index.tsx`, `kanban.tsx`, `pedidos.$orderId.tsx`, `rotas.$routeId.tsx` e `rotas.index.tsx`.
- `rotas.index.tsx`: na agregação por cliente da estimativa, `municipio` passa a receber a cidade do espelho em vez de `null`.
- Sem alteração em `src/lib/frete-simulacao.ts`.
