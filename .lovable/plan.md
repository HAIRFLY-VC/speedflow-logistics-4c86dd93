# Impressão da rota no formato "entrega + detalhamento" (PATCH v1.17.3)

## O que vai mudar

Hoje a impressão mostra uma tabela única em que o cliente aparece "mesclado" na primeira linha do grupo. Vamos reorganizar para ficar igual à tela de detalhe da rota:

- **Linha totalizadora da entrega** (destacada): número da entrega, nome do cliente com código do ERP, UF · Cidade · Bairro, quantidade de pedidos, valor total e peso total da entrega.
- **Logo abaixo, o detalhamento dos pedidos** dessa entrega, um por linha, com: Pedido, Status, Filial, NF, Borderô, Vendedor, Agenda, Dt. pedido, Dt. agenda, Valor, Peso e Observações (OBS / OBS Logíst. / INF_CMP — conforme a opção "Observações" ligada).
- Ao final, mantém o **total geral da rota** (entregas, pedidos, valor e peso).

Colunas novas em relação à impressão atual: **Vendedor** e **Dt. pedido** (já existem na tela de detalhe). Se a largura ficar apertada no papel, a fonte já é reduzida pela opção de tamanho e o modo paisagem segue como padrão.

## O que NÃO muda

- Resumo, mapa, assinaturas, opções de impressão e a configuração salva no perfil do usuário continuam iguais.
- Nenhuma alteração no banco de dados nem em integrações — a impressão só lê os dados.
- Nenhuma flag nova: segue a flag `impressaoRota` já ativa em teste e produção.

## Detalhes técnicos

- Arquivo alterado: `src/components/print/RotaPrintDocument.tsx` — a seção "Entregas e pedidos" passa de `rowSpan` para linha de grupo (totalizadora) + linhas de detalhe, reutilizando os dados já carregados (`listarPedidosDetalheRota`).
- Classificação: **PATCH** (v1.17.3) — mudança de apresentação, sem alterar comportamento.
- Atualizar `src/config/version.ts` e `CHANGELOG.md`.

## Checklist para publicar

- **Testar no preview:** abrir a impressão de uma rota com entregas de vários pedidos (ex.: rota 461) e conferir: linha totalizadora por entrega, pedidos listados abaixo, totais batendo com a tela de detalhe, quebras de página e o modo Retrato/Paisagem.
- **Migrações:** nenhuma.
- **Flags:** nenhuma ação — `impressaoRota` já está ativa nos dois ambientes.
- **Como reverter:** voltar à versão anterior no histórico do Lovable.
