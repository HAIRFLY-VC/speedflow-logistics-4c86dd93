# Corrigir erro ao carregar rotas

## Diagnóstico confirmado

A tela de Rotas falha porque a consulta solicita `orders(..., customers(...))`, mas o banco central não possui a tabela `speedflow.customers` nem um relacionamento entre `orders` e `customers`. A tabela `orders` possui diretamente os dados necessários para entrega, incluindo `delivery_address`, `delivery_latitude`, `delivery_longitude` e `erp_cod_cliente`.

A mesma relação inválida também aparece em outras telas e funções de sugestões, portanto a correção será aplicada a todos os caminhos identificados, não apenas à listagem de Rotas.

## O que será feito

1. Remover `customers(...)` das consultas feitas contra o banco central.
2. Atualizar os tipos e mapeamentos das telas para ler diretamente de `orders`:
   - coordenadas efetivas pelo endereço de entrega do pedido;
   - endereço/cidade apenas quando já disponível nos campos do pedido, sem tentar acessar uma tabela inexistente;
   - código ERP do cliente quando necessário para identificação e geocodificação.
3. Ajustar a tela de Rotas para que a listagem, totais, cálculo estimado de frete e detalhamento das paradas continuem funcionando sem o relacionamento de clientes.
4. Ajustar as consultas de sugestões de rotas, detalhamento de rota, pedidos, Kanban e Minhas Rotas que usam o mesmo relacionamento inválido.
5. Onde a lógica de sugestões atualmente precisa de endereço ou coordenadas de cliente, usar os dados do pedido e o cache `customer_geo` existente, mantendo o comportamento de geocodificação sem criar uma tabela paralela.
6. Validar a tela de Rotas no preview e conferir que o erro de schema desapareceu; depois verificar as consultas irmãs e os estados de erro no navegador.

## Detalhes técnicos

- Principal ajuste em `src/routes/_authenticated/rotas.index.tsx`: selecionar os campos de entrega diretamente em `orders`, remover o tipo `customers` e adaptar cidade/endereço usados no cálculo.
- Ajustes correlatos em `src/routes/_authenticated/rotas.$routeId.tsx`, `src/routes/_authenticated/sugestao-rotas.tsx`, `src/routes/_authenticated/pedidos.index.tsx`, `src/routes/_authenticated/kanban.tsx`, `src/routes/_authenticated/minhas-rotas.tsx` e `src/lib/route-suggestions.functions.ts`.
- Não será criada a tabela `customers`, nem alterado o banco central para inventar um relacionamento que não existe.
- Após as alterações, rodar a validação do projeto e testar a rota `/rotas` com a sessão do preview.