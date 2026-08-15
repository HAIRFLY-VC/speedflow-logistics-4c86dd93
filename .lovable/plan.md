# Centralizar os dados num banco só

## Abordagem escolhida: Opção A — Federação

O banco externo continua sendo a fonte única de clientes, produtos, vendedores e vendas. O SpeedFlow lê essas tabelas em tempo real, sem cópia local, através de uma conexão de leitura direta. Nada é duplicado e os outros projetos Lovable não mudam nada.

Dois pontos de contexto que sustentam essa escolha:

- Este app roda no banco gerenciado pelo Lovable Cloud, e esse vínculo não pode ser trocado por outro projeto Supabase depois de criado — então a federação é justamente o caminho que mantém o banco externo como central.
- Confirmei, consultando o banco atual, que `clientes`, `produtos`, `vendas`, `vendedores` e `ger_expedicao` não existem aqui — são mesmo de outro banco, e a sobreposição com `customers`/`products` é real.


## Etapa 1 — Acesso e mapeamento

1. Você salva a string de conexão de leitura do banco externo como segredo (vou abrir o formulário seguro para isso).
2. Eu leio a estrutura real: colunas, tipos, chaves, índices e volume de linhas de `clientes`, `produtos`, `vendas`, `vendedores`, `ger_expedicao`, das views e das matviews.
3. Eu te devolvo um mapa de-para lado a lado com o que já existe aqui (`customers`, `products`, `orders`, `order_items`), apontando:
   - o que é a mesma informação com nome diferente (redundância real),
   - o que só existe lá,
   - o que só existe aqui e não tem equivalente (CT-e, rotas, auditoria de frete, aprovações).

Esta etapa é só leitura e análise. Nada muda ainda.

## Etapa 2 — Decidir o corte, com você

Com o mapa na mão, decidimos junto quais entidades passam a ser lidas do banco externo. A leitura inicial, a confirmar:

- **Vêm do banco externo:** clientes, produtos, vendedores e, possivelmente, vendas/expedição como origem dos pedidos.
- **Ficam neste banco:** todo o módulo logístico que não existe lá — pedidos em máquina de estados, rotas, borderôs, entregas, CT-e, tabelas de frete, auditoria e pagamento de frete, perfis e permissões.
- **Chave de ligação:** como o ERP GCF é a fonte da verdade dos dois lados, o identificador do ERP é o que costura os dois bancos.

## Etapa 3 — Implementação da leitura unificada

- Uma camada de acesso no servidor do app que consulta o banco externo com credencial somente-leitura, nunca exposta ao navegador.
- As telas de Clientes e Produtos passam a exibir os dados do banco externo, deixando de manter cópia local.
- As tabelas locais equivalentes deixam de ser alimentadas pela sincronização com o ERP e ficam reduzidas ao mínimo necessário para as chaves estrangeiras do módulo logístico — ou são removidas, se der para eliminar totalmente.
- A sincronização com o ERP é ajustada para não gravar duas vezes a mesma informação.

## Etapa 4 — Objetos novos no banco externo

Se algum dado do SpeedFlow precisar ficar visível para os outros projetos, criamos esses objetos no banco externo nesta etapa, e não antes — só depois do mapa da Etapa 1 dá para dizer quais são.

## Detalhes técnicos

- Acesso ao banco externo pelo servidor via server functions do TanStack Start, com a string de conexão guardada como segredo; alternativamente por Postgres FDW, se preferir enxergar as tabelas externas como se fossem locais.
- Nenhuma credencial do banco externo vai para o código do navegador.
- As tabelas do print aparecem como `UNRESTRICTED`, ou seja, sem RLS. Antes de qualquer acesso do app, precisamos definir se elas serão lidas apenas pelo servidor (com credencial protegida) ou se será necessário ativar controle de acesso lá.
- Migração de dados só acontece se escolhermos a Opção B; na Opção A não há migração, apenas leitura.

## O que eu preciso de você para começar

A escolha entre Opção A e Opção B, e a string de conexão de leitura do banco externo.
