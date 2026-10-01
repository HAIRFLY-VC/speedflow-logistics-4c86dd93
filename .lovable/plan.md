# Gestor: card sempre visível, atribuir rota e valor/peso por pedido

## Classificação
- PATCH: 1.16.1 para 1.16.2, com entrada no CHANGELOG.

## O que já foi verificado
- Existe um único usuário Gestor. Ele tem menu personalizado com Rotas Pendentes, Pedidos sem rota e Autorizar pagamento.
- No código, nem o card nem a ação "Atribuir rota" bloqueiam o Gestor. O servidor também aceita Administrador, Gestor e Operador.
- A causa exata da falha para o Gestor ainda **não foi confirmada**.

## O que será feito
1. **Diagnóstico como Gestor:** entrar no preview como o Gestor (vai pedir sua aprovação), abrir Rotas Pendentes e Pedidos sem rota, tentar atribuir rota e registrar a mensagem de erro ou a resposta do servidor. Depois corrigir a causa encontrada, por exemplo a verificação de perfil no servidor ou a leitura dos pedidos.
2. **Card sempre visível em Rotas Pendentes**, para qualquer perfil:
   - **Com pedidos sem rota:** igual a hoje, com o fundo pulsando.
   - **Sem pedidos:** totais zerados, sem pulsar.
   - **Carregando:** mostra "Carregando…".
   - **Erro:** mostra uma mensagem discreta e o botão "Tentar novamente".
3. **Atribuir rota para o Gestor:** garantir que o botão "Atribuir rota" funciona para ele do começo ao fim, tanto em rota existente quanto em rota nova.
4. **Valor e peso de cada pedido** na tela Pedidos sem rota: novas colunas **Valor** e **Peso** em cada linha de pedido. O total por cliente continua no cabeçalho do grupo.

## Detalhes técnicos
- Card: em `RotasView.tsx`, deixar de exigir `pedidos > 0`. A animação só roda quando houver pedidos. Os estados de carregando e erro vêm de `pedidosSemRotaQ`, e o botão chama `refetch()`.
- Colunas: `total_amount` e `weight` já são carregados. Basta exibi-los na tabela de pedidos de `pedidos-sem-rota.tsx`.
- Permissão: se o diagnóstico apontar `has_role`, trocar a verificação no servidor por `is_staff` ou por uma checagem equivalente, sem mudar as regras de acesso no banco.

## Risco e reversão
- Risco baixo. Sem mudança no banco. Escritas no ERP só acontecem no teste de atribuição, e só se você autorizar.
- Para desfazer: voltar para a versão anterior no histórico.

## Checklist para publicar
- Como Gestor: o card aparece, a atribuição de rota funciona e o valor e o peso aparecem em cada pedido.
- Migrações: nenhuma. Opções para ligar: nenhuma. Publicar para valer na versão oficial.
