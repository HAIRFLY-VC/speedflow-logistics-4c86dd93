# Impressão da rota no formato "entrega + detalhamento" (PATCH v1.18.1)

## O que vai mudar

Hoje a impressão mostra uma tabela única em que o cliente aparece "mesclado" na primeira linha do grupo. Vamos reorganizar para ficar igual à tela de detalhe da rota:

- **Linha totalizadora da entrega** (destacada): número da entrega, nome do cliente com código do ERP, UF · Cidade · Bairro, quantidade de pedidos, valor total e peso total da entrega.
- **Logo abaixo, o detalhamento dos pedidos** dessa entrega, um por linha, com: Pedido, Status, Filial, NF, Borderô, Vendedor, Agenda, Dt. pedido, Dt. agenda, Valor, Peso e Observações (OBS / OBS Logíst. / INF_CMP — conforme a opção "Observações" ligada).
- Ao final, mantém o **total geral da rota** (entregas, pedidos, valor e peso).

Colunas novas em relação à impressão atual: **Vendedor** e **Dt. pedido** (já existem na tela de detalhe). A impressão será apresentada inicialmente em **modo Retrato**; depois que o usuário alterar e salvar outra orientação, prevalece sua última configuração pessoal.

## O que NÃO muda

- Resumo, mapa, assinaturas, opções de impressão e a configuração salva no perfil do usuário continuam iguais.
- Nenhuma alteração no banco de dados nem em integrações — a impressão só lê os dados.
- Nenhuma flag nova: segue a flag `impressaoRota` já ativa em teste e produção.

## Detalhes técnicos

- Arquivo alterado: `src/components/print/RotaPrintDocument.tsx` — a seção "Entregas e pedidos" passa de `rowSpan` para linha de grupo (totalizadora) + linhas de detalhe, reutilizando os dados já carregados (`listarPedidosDetalheRota`).
- Classificação: **PATCH** (v1.18.1) — mudança de apresentação e do padrão inicial, sem alterar o fluxo.
- Atualizar `src/config/version.ts` e `CHANGELOG.md`.

## Checklist para publicar

- **Testar no preview:** abrir a impressão de uma rota com entregas de vários pedidos (ex.: rota 461) e conferir: abertura inicial em Retrato, linha totalizadora por entrega, pedidos listados abaixo, totais, largura das colunas e quebras de página.
- **Migrações:** nenhuma.
- **Flags:** nenhuma ação — `impressaoRota` já está ativa nos dois ambientes.
- **Como reverter:** voltar à versão anterior no histórico do Lovable.
