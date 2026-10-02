# Impressão do detalhamento da rota (v1.17.0 — MINOR)

## O que o usuário verá
- Em **Rotas Pendentes** e em **Autorizar pagamento de frete**, um novo ícone de impressora na coluna de ações de cada rota (ao lado do lápis). Também um botão "Imprimir" no topo da tela de detalhe da rota.
- Ao clicar, abre uma **tela de impressão** (nova aba) com pré-visualização da folha e um painel de opções:
  - **Seções a incluir** (liga/desliga): cabeçalho da rota, resumo (valor, peso, entregas, distância, % frete), mapa da rota, lista de entregas agrupada (UF > Cidade > Bairro > Cliente), detalhe de pedidos (NF, borderô, filial, valor, peso), observações, espaço de assinaturas (motorista / conferente / expedição) e totais.
  - **Layout**: retrato ou paisagem, A4 ou Carta, tamanho de fonte (pequena/normal/grande), modo econômico (sem cores/fundos).
  - **Ordenação** das entregas: por distância (sequência da rota) ou por cliente.
  - **Ações**: Imprimir, Salvar em PDF (pelo diálogo do navegador), Voltar.
- A folha impressa terá: logotipo/nome da empresa, título, data/hora e usuário que imprimiu, número de página "Página X de Y" no rodapé, cabeçalho de tabela repetido em cada página, linhas que não se partem no meio e quebra de página entre grupos quando necessário.
- As preferências escolhidas ficam lembradas para a próxima impressão.
- Sem exibir PIX em nenhuma parte (regra existente).

## Como será feito (técnico)
- Módulo único `src/components/print/`:
  - `PrintLayout.tsx` (moldura: cabeçalho, rodapé, contagem de páginas via CSS `@page` + `counter(page)`), `PrintToolbar.tsx` (painel de opções, oculto com `print:hidden`), `usePrintPrefs.ts` (preferências em localStorage), `print.css` (regras `@media print`, `break-inside: avoid`, `thead { display: table-header-group }`, orientação/tamanho dinâmicos por `@page`).
  - Genérico para ser reaproveitado por futuras impressões.
- `src/components/print/RotaPrintDocument.tsx`: monta as seções da rota reaproveitando as mesmas consultas da tela de detalhe (rota, paradas, manifesto, clientes ERP) e o mapa estático (aguarda o carregamento antes de liberar o botão Imprimir).
- Nova página `src/routes/_authenticated/rotas.$routeId.imprimir.tsx` (sem menu lateral, com head próprio); aberta com `window.open` em nova aba a partir do ícone em `RotasView.tsx` (serve às duas telas) e do botão no detalhe `rotas.$routeId.tsx`.
- Atrás de flag `impressaoRota` em `src/config/features.ts` (ligada em teste e produção, conforme preferência registrada).
- Atualizar `version.ts` para 1.17.0 e `CHANGELOG.md`.

## Riscos
- Nenhuma mudança no banco nem em integrações; apenas leitura.

## Verificação
- Build OK; abrir a impressão de uma rota com pedidos, conferir pré-visualização, alternar seções/orientação e gerar PDF de teste para checar quebras de página e rodapé.
