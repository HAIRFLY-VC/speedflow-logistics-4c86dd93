# Card "Pedidos pendentes sem rota" sempre visível

## Classificação
- PATCH: 1.16.1 para 1.16.2, com entrada no CHANGELOG.

## O que muda (tela Rotas Pendentes)
- O card aparece sempre, para qualquer perfil (Administrador, Gestor, Operador). Ele não depende mais de haver pedidos sem rota nem de a consulta dar certo.
- **Com pedidos sem rota:** igual a hoje. Mostra os totais, o fundo pulsa em vermelho claro e o clique abre "Pedidos sem rota".
- **Sem pedidos sem rota:** mostra os totais zerados, sem pulsar. O clique continua abrindo a tela.
- **Carregando:** mostra "Carregando…" no lugar dos números.
- **Erro na consulta:** mostra a mensagem discreta "Não foi possível carregar os totais" e um botão "Tentar novamente". Nesse caso o card não leva para outra tela.
- A grade fica sempre com 5 cards no computador, e o card continua na última posição, à direita.

## Detalhes técnicos
- Em `RotasView.tsx`, a exibição do card passa a depender só de `mostrarCardSemRota`, sem exigir `pedidos > 0`. A animação fica condicionada a `pedidos > 0`.
- Estados de carregando e erro vêm de `pedidosSemRotaQ`. O botão "Tentar novamente" chama `refetch()` e impede que o clique siga o link.
- A consulta compartilhada `pedidosSemRotaQueryOptions` continua a mesma.

## Risco e reversão
- Risco baixo: só muda a exibição. Sem banco, sem ERP e sem nenhuma opção para ligar.
- Para desfazer: voltar para a versão anterior no histórico.

## Checklist para publicar
- Como Gestor, abrir Rotas Pendentes e conferir se o card aparece. Se houver erro, a mensagem vai indicar a causa.
- Conferir se os totais coincidem com a tela "Pedidos sem rota".
- Migrações: nenhuma. Opções para ligar: nenhuma. Publicar para o Gestor ver na versão oficial.
