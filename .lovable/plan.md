# Painel de Separação de Pedidos

Novo painel gerencial em `/separacao`, alimentado pela tabela `separacao` do banco do ERP.

## O que os dados oferecem

Cada linha é um pedido entregue à equipe de separação, com: pedido, separador (código e nome), situação, quantidade de caixas separadas, prioridade e quatro marcos de tempo — liberação do pedido, início da separação, fim da separação e fim da conferência.

Verificado nos dados atuais: 13.520 registros desde jan/2025, 13.417 concluídos e o restante em andamento; 58 sem conclusão de separação; 447 registros em setembro/2026. Só aparecem duas situações: concluído e em separação.

Isso permite medir **fila**, **tempo** (espera, separação, conferência) e **produtividade por pessoa**.

## Indicadores do painel

Cartões no topo (período selecionado, padrão "hoje"):

1. Pedidos na fila — liberados e ainda não iniciados, com a espera do mais antigo.
2. Em separação agora — quantidade e separadores ativos no momento.
3. Concluídos no período — pedidos e caixas separadas.
4. Tempo médio de espera — da liberação até o início da separação.
5. Tempo médio de separação — do início ao fim.
6. Tempo médio de conferência — do fim da separação ao fim da conferência.
7. Caixas por hora da equipe — produtividade média.

Demonstrativos:

- **Produtividade por separador**: pedidos concluídos, caixas separadas, caixas/hora, tempo médio por pedido e tempo médio de conferência; ordenável, com destaque para os melhores e piores tempos.
- **Volume por dia**: barras com pedidos concluídos e caixas por dia no período, para ver picos e dias fracos.
- **Distribuição por hora do dia**: mostra em que horários a equipe produz mais e onde há ociosidade.
- **Envelhecimento da fila**: faixas (até 2h, 2–8h, 8–24h, mais de 24h) dos pedidos aguardando início, para atacar atrasos.
- **Pedidos em aberto (lista)**: pedidos não concluídos com separador, situação, caixas, quando foi liberado e há quanto tempo está parado, com destaque em vermelho acima de 24h.

Filtros no topo: período (hoje, 7 dias, 30 dias, intervalo livre) e separador (múltipla escolha). Todos os cartões e demonstrativos respeitam os filtros.

## Detalhes técnicos

- Leitura server-side via `createServerFn` (`src/lib/separacao.functions.ts`) usando o cliente REST do banco central com `Accept-Profile: public` (a tabela `separacao` está no esquema `public`, não em `speedflow`), protegida por `requireSupabaseAuth` e restrita aos papéis `adm`, `gestor` e `operador`.
- A função busca somente o intervalo filtrado (colunas específicas, paginação de 1.000 linhas) e devolve as agregações já calculadas, evitando o problema de estouro de tempo (502) das telas pesadas.
- A fila/andamento é sempre consultada inteira (registros sem `dt_fim_conf`), independente do período, por ser um volume pequeno.
- Tela em `src/routes/_authenticated/separacao.tsx`, consumida com React Query; cartões compactos e gráficos com Recharts (já usado no projeto); tabela de produtividade reaproveitando o `DataTable` existente (ordenação, filtros de coluna e exportação para Excel).
- Item "Separação" adicionado ao menu do `AppShell` para os papéis com acesso.
- Layout responsivo: cartões em grade que vira coluna única no celular, gráficos com altura reduzida e a lista de pedidos em aberto em formato de cartões no mobile.
