# Pedidos sem rota — listagem completa e agrupada

## Objetivo
Atualizar a tela **Pedidos sem rota** para usar toda a largura disponível, sem rolagem lateral, agrupando pedidos do mesmo cliente e exibindo os detalhes operacionais solicitados.

## Alterações previstas
- Manter cada cliente em um único grupo, com **razão social e código**, UF, cidade e bairro exibidos uma vez no cabeçalho do grupo.
- Listar, dentro do cliente, cada pedido com:
  - código do pedido;
  - status;
  - filial de faturamento;
  - nota fiscal;
  - vendedor e código;
  - agenda;
  - data do pedido;
  - data da agenda;
  - indicadores de OBS, OBS LOGIST e INF_CMP.
- Preservar a seleção por cliente, por pedido e “Selecionar todos os filtrados”, além do fluxo atual de atribuir uma rota.
- Ordenar os grupos na sequência de entrega já calculada a partir do depósito; pedidos do mesmo cliente permanecem juntos.
- Mostrar um ícone somente quando OBS, OBS LOGIST ou INF_CMP tiver conteúdo. No computador, o texto completo abre ao passar o mouse ou focar; em telas de toque, abre ao tocar.
- Substituir a área estreita atual por uma composição responsiva de largura total:
  - no computador, cabeçalho do cliente e grade compacta de pedidos com larguras controladas e quebra apenas nos campos textuais;
  - em telas menores, cada pedido vira um bloco organizado, sem tabela larga e sem rolagem horizontal.
- Manter busca, filtros, distância, valores, peso e quantidade de pedidos já existentes.
- Reaproveitar a consulta de detalhes do ERP já utilizada na capa da rota, ajustando o carregamento em lotes para cobrir toda a lista filtrada sem o limite atual de 1.000 pedidos.

## Versão e segurança
- Classificação: **MINOR**, proposta **v1.11.0**, por ampliar a funcionalidade da listagem sem quebrar o fluxo atual.
- Atualizar a versão e registrar a mudança no changelog em português.
- Não haverá migração nem alteração de dados no banco compartilhado.
- A consulta ao ERP continuará somente leitura.
- A funcionalidade ficará disponível em teste e na versão oficial quando publicada, conforme a política do projeto.

## Validação
- Conferir cliente com um e com vários pedidos, garantindo que os dados do cliente não se repitam.
- Conferir a ordem de entrega e a associação correta dos detalhes a cada pedido.
- Validar os três indicadores de observação com e sem conteúdo.
- Validar busca, filtros, seleção individual, seleção por cliente e atribuição de rota.
- Verificar em computador e celular que todos os dados cabem sem rolagem lateral.
- Confirmar carregamento e estado de erro quando a consulta complementar ao ERP estiver indisponível.

## Checklist para publicar
- Testar manualmente a tela **Pedidos sem rota** no preview, incluindo um cliente com vários pedidos.
- Confirmar os detalhes e a ordem com uma amostra do ERP.
- Migrações aplicadas: nenhuma.
- Flags após publicar: nenhuma.
- Reversão: retornar à versão **1.10.1** no histórico; não há SQL de reversão.
