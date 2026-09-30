# Rota existente: resumo da composição dos pedidos selecionados

Classificação: PATCH (v1.14.2). Nenhuma mudança no banco de dados.

## O que muda para o usuário
Na tela **Pedidos sem rota**, ao abrir o painel de atribuição na aba **Rota existente**, aparece no topo — antes do filtro de cidades e da lista de rotas — um cartão "Pedidos selecionados" com exatamente o mesmo formato dos cartões de rota:

- linha de totais: `R$ 22.141 · 947 kg · 4 entrega(s)` (entregas = clientes distintos);
- linha de composição: `PE: RECIFE (2), ABREU E LIMA (1) · PB: JOÃO PESSOA (1)` — UF em negrito, cidades ordenadas pela quantidade de entregas, mesmo layout dos cartões de rota;
- o cartão usa o mesmo estilo visual dos cartões de rota (borda, texto em duas linhas), ficando claro com o que cada rota será comparada.

Se nada estiver selecionado, o cartão não aparece. Sem entregas identificáveis, mostra "Sem entregas identificadas".

## Detalhes técnicos
- Arquivo: `src/routes/_authenticated/pedidos-sem-rota.tsx` (aba "existente", JSX a partir da linha ~997).
- Novo `useMemo` `resumoSelecaoUfs`: parte de `linhas` filtradas pelos ids em `selecionados`, agrupa por cliente (`l.codCliente || l.cliente`) usando `l.uf`/`l.cidade` (mesmos dados do hook `useClientesErp`), e monta a estrutura `{ uf, cidades: [{ nome, qtd }] }[]` já ordenada, idêntica à usada em `resumoPorRota`.
- Reaproveita `brl`, `chaveCidade` e os estilos existentes dos cartões.
- Sem feature flag (política do projeto: oficial igual ao teste).
- Atualizar `src/config/version.ts` para 1.14.2 e adicionar entrada no `CHANGELOG.md`.

## Checklist para publicar
- Testar: selecionar pedidos de 1 ou 2 cidades, abrir o painel, conferir se o cartão de seleção soma valor/peso/entregas iguais ao rodapé fixo e se a composição de cidades casa com os destaques dos cartões de rota.
- Migrações: nenhuma.
- Reverter: voltar para a versão anterior no histórico.
