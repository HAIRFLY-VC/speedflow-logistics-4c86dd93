# Etapa 2 — Pedidos referenciando o banco central

Decisões confirmadas:
1. Pedidos passam a referenciar o cliente do banco central (`cod_cliente`), sem tabela local de clientes.
2. `products` e `order_items` são removidas.
3. SpeedFlow continua dono de rotas/borderôs; `ger_expedicao` fica apenas como histórico do ERP (nenhuma leitura no app por enquanto).

## O que muda

### Banco (Lovable Cloud)
- `orders` ganha `erp_cod_cliente` (código do cliente no banco central), preenchido a partir do vínculo atual antes de qualquer remoção.
- Nova tabela `customer_geo`: cache de geocodificação por `cod_cliente` (latitude, longitude, endereço usado). Não é cópia de cadastro — só coordenadas, que o banco central não tem.
- Remoção de `order_items` e `products` (ambas vazias).
- Remoção da tabela `customers` depois que todas as telas deixarem de usá-la.

### Aplicação
- Nova função de servidor que busca, em lote, os dados de clientes do banco central por lista de `cod_cliente` (razão social, fantasia, CNPJ, cidade/UF, endereço), com cache em memória por requisição.
- Telas de Pedidos, Kanban, Rotas, Detalhe de rota, Minhas rotas e Sugestão de rotas passam a exibir o cliente vindo desse lote, em vez do join local.
- Roteirização: coordenada do pedido continua vindo de `delivery_latitude/longitude`; quando ausente, usa `customer_geo`, que é preenchido pela geocodificação do endereço do banco central.
- Sincronização com o ERP deixa de criar/atualizar clientes locais: grava apenas `erp_cod_cliente` no pedido e agenda a geocodificação no cache.

## Ordem de execução
1. Migração 1: `erp_cod_cliente` + backfill + `customer_geo` (com geocodificação migrada de `customers`).
2. Ajuste da sincronização do ERP e da camada de leitura de clientes.
3. Ajuste das telas que hoje fazem join com `customers`.
4. Migração 2: remover `order_items`, `products` e `customers`.

## Observação técnica
A leitura direta do Postgres central foi validada no preview. Vale publicar após a etapa 1 para confirmar a conexão no ambiente publicado; se houver bloqueio de TCP, troco a camada de leitura para a API REST do banco central sem mudar as telas.
