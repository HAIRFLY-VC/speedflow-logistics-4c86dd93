# Card "% Frete do ciclo comercial" e painel de custo de frete

**Classificação:** MINOR — versão proposta **1.29.0**.

## O que será feito

### 1. Card em Rotas Pendentes
- Novo card na mesma linha dos indicadores: **% Frete — ciclo comercial atual**.
- Mostra o % (frete confirmado ÷ valor das mercadorias), o valor do frete, o valor das mercadorias e o período do ciclo (ex.: 26/09 a 25/10).
- Base: pedidos **faturados** dentro do período do ciclo comercial atual (calendário comercial já sincronizado do ERP).
- Frete: **somente valores confirmados** (pagamento confirmado ou provisionamento gravado).
- Clique leva ao novo painel.

### 2. Novo painel "Custo de Frete"
- Filtro de ciclo comercial (padrão: atual), com opção de escolher ciclos anteriores.
- Totais no topo: frete confirmado, mercadorias, % frete, pedidos, entregas, peso, frete por kg.
- Detalhamento com valor de frete, mercadorias e % em cada dimensão:
  - Fretista / Transportadora (com tipo F/T/P e código ERP);
  - UF e Cidade;
  - Cliente (nome e código ERP);
  - Vendedor;
  - Rota;
  - Evolução: gráfico dos últimos 6 ciclos comerciais.
- Tabelas ordenáveis e exportáveis, seguindo o padrão das outras listagens.
- Novo item no menu lateral, controlado pelas permissões de menu por usuário.

## Detalhes técnicos
- Uma única função de leitura no servidor calcula card e painel, garantindo os mesmos números; leitura paginada (sem truncar em 1000 registros).
- Frete de cada rota rateado entre os pedidos pelo valor das mercadorias, para permitir as visões por cliente/vendedor/cidade.
- Pedidos faturados sem frete confirmado entram nas mercadorias (reduzem o %) e aparecem destacados como "sem frete confirmado".
- Feature flag `painelCustoFrete` ativa em teste e produção (política atual).
- Item adicionado em `menu-items.ts`.

## Impacto e segurança
- Somente leitura: sem migração, sem gravação no ERP ou no banco compartilhado.
- Nenhuma mudança nas telas existentes além do card adicional.

## Checklist para publicar
- Conferir o % do card com o painel e com uma conta manual de algumas rotas.
- Conferir troca de ciclo e as visões por dimensão.
- Liberar o novo menu para os usuários desejados em Usuários e Papéis.
- Migrações: nenhuma. Flags: nenhuma ação.
- Reversão: voltar à 1.28.1 pelo histórico.
