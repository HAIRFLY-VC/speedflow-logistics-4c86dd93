# Changelog

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
