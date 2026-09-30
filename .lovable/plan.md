# Rota existente: filtro por cidade e mais detalhes

Classificação: MINOR (v1.14.0). Nenhuma mudança no banco de dados.

## O que muda para o usuário
Na tela **Pedidos sem rota**, depois de escolher os pedidos e abrir a aba **Rota existente**:

1. **Opção "Só rotas que passam nas mesmas cidades"** (chave liga/desliga, ligada por padrão). Quando ligada, aparecem só as rotas planejadas com pelo menos uma entrega em uma das cidades dos pedidos escolhidos. Um texto mostra "X de Y rotas" e as cidades usadas no filtro.
2. **A lista de rotas passa a ser em cartões** (no lugar da caixa de seleção atual), com busca por nome. Cada cartão mostra:
   - nome da rota e data de expedição;
   - valor total, peso total e quantidade de entregas (clientes diferentes);
   - resumo dos locais: UF com cidades e quantas entregas em cada (ex.: "PE: Recife (4), Olinda (2) · PB: João Pessoa (1)"), com as cidades em comum com a seleção em destaque.
   - Tocar no cartão escolhe a rota; o botão "Confirmar atribuição" funciona como hoje.
3. Rotas sem nenhum pedido aparecem como "Rota vazia" e somem quando o filtro de cidade está ligado.

## Detalhes técnicos
- Arquivo: `src/routes/_authenticated/pedidos-sem-rota.tsx` (aba "existente", `rotasQ`).
- Nova consulta paginada (lotes de 1000) de `route_orders` + `orders` (`total_amount`, `weight`, `erp_cod_cliente`) para os IDs das rotas planejadas listadas.
- Cidade/UF de cada entrega por `useClientesErp` (`cidadeCliente`/`ufCliente`); comparação de cidade com UF + nome normalizado (sem acento, maiúsculas).
- Cidades da seleção derivadas dos pedidos selecionados pelo mesmo hook.
- Sem feature flag separada (política do projeto: oficial igual ao teste).
- Atualizar `src/config/version.ts` e `CHANGELOG.md`.

## Checklist para publicar
- Testar: selecionar pedidos de 1 ou 2 cidades, abrir "Rota existente", ligar/desligar o filtro, conferir os totais de uma rota com a tela de Rotas Pendentes, atribuir.
- Migrações: nenhuma.
- Reverter: voltar para a versão anterior no histórico.
