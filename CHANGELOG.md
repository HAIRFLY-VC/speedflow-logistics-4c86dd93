# Changelog

## [1.11.0] - 2026-09-29
### Alterado
- Pedidos sem rota agora agrupa cada cliente uma única vez, ordena por distância nos níveis UF, cidade, bairro e cliente e exibe os detalhes operacionais dos pedidos e suas observações sem rolagem lateral.

## [1.10.1] - 2026-09-29
### Corrigido
- Fretistas voltam a abrir o pedido a partir de "Minhas Rotas" e das notificações sem a mensagem "Você não tem acesso a esta tela".

## [1.10.0] - 2026-09-29
### Alterado
- A lista de pedidos abaixo do mapa da rota agora agrupa por cliente, segue a ordem de entrega e mostra status, filial, nota, vendedor, agenda, datas e observações (ao passar o mouse).

## [1.9.3] - 2026-09-29
### Alterado
- A capa da rota agora exibe no resumo o percentual do frete, a quantidade de pedidos e o peso total.
- O campo "Fretista interno" não aparece mais no modo de visualização; a alteração do responsável permanece no botão "Editar".

## [1.9.2] - 2026-09-29
### Corrigido
- A listagem de Rotas Pendentes agora reserva espaço para todas as colunas e exibe integralmente os valores e a ação de edição, sem rolagem lateral.

## [1.9.1] - 2026-09-29
### Corrigido
- As linhas totalizadoras de Rotas Pendentes agora têm destaque próprio, diferente do foco das rotas, e exibem a data completa na coluna correta.

## [1.9.0] - 2026-09-29
### Alterado
- Rotas Pendentes agora abre os grupos de datas já expandidos, mantendo o controle individual para comprimir e reabrir.
- A listagem de Rotas Pendentes foi compactada para exibir todas as colunas na largura disponível do computador, sem rolagem lateral.

## [1.8.5] - 2026-09-29
### Corrigido
- Pedidos sem rota: pedidos que ainda estavam no agrupamento anterior (ex.: "NÃO PLANEJADO") agora são movidos para a rota escolhida, em vez de dar erro de pedido duplicado.

## [1.8.4] - 2026-09-29
### Corrigido
- Pedidos sem rota: atribuir a uma rota existente funciona mesmo quando a sincronização com o ERP recriou a rota no meio do processo (busca pelo número da rota no ERP).

## [1.8.3] - 2026-09-29
### Corrigido
- Pedidos sem rota: ao atribuir a uma rota que foi removida/reorganizada pela sincronização do ERP, o app avisa com mensagem clara e atualiza a lista de rotas; a lista é recarregada sempre que o painel é aberto.

## [1.8.2] - 2026-09-29
### Corrigido
- Os valores dos cards de indicadores (Rotas Pendentes) não quebram mais em duas linhas; fonte reduzida para caber.
- O card "Pedidos pendentes sem rota" agora mostra os quatro totais em grade 2x2 (Mercadorias | Pedidos / Peso | Entregas), mantendo a mesma altura dos demais cards.

## [1.8.1] - 2026-09-29
### Alterado
- O card "Pedidos pendentes sem rota" agora ocupa a mesma linha dos indicadores, na última posição à direita, e some quando não há pedidos pendentes.

## [1.8.0] - 2026-09-29
### Adicionado
- Rotas Pendentes ganhou um card com valor, peso, pedidos e entregas sem rota; quando há pendências, o fundo pisca em vermelho claro e o clique abre a tela "Pedidos sem rota".

## [1.7.4] - 2026-09-29
### Alterado
- Na coluna "Pedidos por status", os status "01-DIGITADO" e "02-CRITICADO" aparecem em vermelho (código e contagem).

## [1.7.3] - 2026-09-29
### Alterado
- Código da rota exibido sem o prefixo "ID" em todas as telas; coluna do código mais estreita.
- Coluna "Pedidos por status" mais larga e sem quebra de linha em nenhum status (ex.: "09-CONFERIDO").

## [1.7.2] - 2026-09-29
### Alterado
- Na listagem de rotas, os status longos do ERP agora aparecem abreviados ("06-SEP. SOLIC.", "03.1-*LIB-CRIT.", "04-LIB. PRO"), para cada status caber em uma única linha na coluna "Pedidos por status".

## [1.7.1] - 2026-09-29
### Corrigido
- Rotas que ficaram sem pedidos no ERP (ex.: 411) não mostram mais pedidos/entregas antigos: a conferência com o ERP passa a remover os vínculos também quando a rota está vazia (exceto rotas com pagamento confirmado).

## [1.7.0] - 2026-09-29
### Alterado
- Gestor agora pode lançar valor adicional na rota em "Autorizar pagamento de frete"; reabrir/substituir o frete já confirmado continua exclusivo do administrador.

## [1.6.1] - 2026-09-29
### Alterado
- Confirmar pagamento mais rápido: reaproveita a conferência feita ao abrir o lápis (até 2 min), grava no ERP até 5 pedidos ao mesmo tempo e cria a tarefa do Bitrix em segundo plano (falhas vão para a fila de pendências).

## [1.6.0] - 2026-09-29
### Alterado
- A versão oficial passa a ter todas as funcionalidades do teste ao publicar: menu lateral automático (computador) e conferência dos pedidos da rota com o ERP em Autorizar pagamento de frete.

## [1.5.2] - 2026-09-29
### Alterado
- Histórico de status do pedido (clique no código do pedido) liberado também na versão oficial, para todos os tipos de usuário.

## [1.5.1] - 2026-09-29
### Corrigido
- Pedidos reexpedidos após ocorrência (borderô com status O) passam a usar o borderô novo no detalhamento da autorização de pagamento e na tarefa do Bitrix (ex.: pedido 4135213 → borderô 32381). Rotas já pagas mantêm o borderô gravado.

## [1.5.0] - 2026-09-29
### Adicionado
- Autorizar pagamento de frete: ao abrir a tela ou o lápis, o app confere os pedidos de cada rota no ERP e iguala o app (remove os que saíram da rota e inclui os que faltam). Nada é alterado no ERP. Rotas com pagamento confirmado só exibem aviso. Ligado apenas no teste.

## [1.4.0] - 2026-09-29
### Adicionado
- Clique no código do pedido (em todas as telas) abre o histórico de status do pedido registrado no ERP (ligado só no ambiente de TESTE).

## [1.3.0] - 2026-09-29
### Adicionado
- Gestor/Administrador pode atribuir o responsável de uma rota sem responsável; a alteração é gravada no ERP.
### Corrigido
- A seta de voltar da rota retorna para a tela de origem (Rotas Pendentes ou Autorizar pagamento de frete).

## [1.2.0] - 2026-09-29
### Alterado
- Usuários com papel Gestor podem autorizar pagamento a fretista (rotas) e aprovar/autorizar pagamento de CT-e.

## [1.1.3] - 2026-09-29
### Corrigido
- Vínculo com o Bitrix agora é gravado mesmo para usuários sem perfil no banco central (ex.: Gutemberg); a tela avisa se a gravação falhar.

## [1.1.2] - 2026-09-29
### Corrigido
- Menu lateral automático (teste): no computador o menu inicia recolhido, abre ao passar o mouse e recolhe ao sair; o botão do topo fixa o menu aberto.

## [1.1.1] - 2026-09-29
### Corrigido
- A crítica de falta de PIX só aparece quando o tipo do responsável é fretista (F). Para transportadoras e frota própria, atualizar o cadastro informa apenas que os dados foram atualizados, sem mencionar PIX.

## [1.1.0] - 2026-09-29
### Adicionado
- Aviso em vermelho nas telas de rotas quando o tipo do fretista no ERP não é EF/ET/EM (ou o código não existe no cadastro), com botão para consultar o ERP novamente.
- Menu lateral abre ao passar o mouse e recolhe ao sair, no computador (ligado só no ambiente de TESTE).

## [1.0.1] - 2026-09-29
### Alterado
- A coluna "Tipo" (F fretista, T transportadora, P próprio) voltou a aparecer em todas as telas de rotas, sempre imediatamente após "Fret / Transp", inclusive na tela "Autorizar pagamento de frete".
- Responsáveis do ERP com natureza fora de EF/ET/EM (ex.: FT) agora mostram um selo âmbar com o código da natureza, em vez de "—" sem explicação.

### Corrigido
- A lista de responsáveis do ERP só trazia os 1.000 primeiros cadastros; códigos além disso ficavam sem tipo/PIX/natureza nas telas de rotas.
