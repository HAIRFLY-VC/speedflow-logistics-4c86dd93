# Rota 423 não aparece em "Autorizar pagamento de frete"

## Diagnóstico (confirmado)

No ERP, a rota 423 ("T- ALAGOAS", Sandro Neves Pereira) tem pedidos. Na cópia do app, ela aparece assim:
- criada hoje às 09:15 e com borderô emitido às 09:19;
- tem número do ERP;
- tem **0 pedidos vinculados no app**: os pedidos do ERP não foram copiados.

A tela esconde toda rota sem pedidos vinculados no app. Quem traz os pedidos e notas do ERP para a rota é a auditoria automática. Só que ela roda apenas nas rotas que já estão na tela. Isso cria um impasse: a rota não aparece porque não tem pedidos, e não recebe pedidos porque não aparece.

Os pedidos receberam borderô em só 4 minutos, então saíram da lista de "pendentes de expedição" do ERP antes da sincronização vinculá-los à rota.

## Correção (PATCH, v1.14.5)

1. **Auditoria das rotas vazias com borderô:** antes de montar a lista, a tela identifica as rotas que têm número do ERP e borderô emitido, mas nenhum pedido vinculado. Ela as envia para a auditoria, que importa do ERP os pedidos e as notas. Em seguida a lista é recarregada.
2. **Exibição:** essas rotas passam a aparecer em "Autorizar pagamento de frete" mesmo durante a importação, com o aviso "Importando pedidos do ERP". Assim o usuário enxerga a rota em vez de ela sumir.
3. Se a auditoria não encontrar pedidos no ERP, a rota continua visível com o selo "Sem pedidos no ERP", e a confirmação do pagamento fica bloqueada.
4. Atualizar a versão para 1.14.5 e registrar no CHANGELOG.

## Riscos

- Nenhuma mudança no banco. A auditoria só lê do ERP e grava os vínculos no app, como já faz hoje.
- Se o ERP só devolver os pedidos de uma rota enquanto eles ainda não foram expedidos, a importação pode voltar vazia. Nesse caso aparece o item 3, e vai ser preciso uma consulta do ERP que inclua pedidos já expedidos. Isso continua pendente desde a v1.14.1.

## Checklist para publicar

- No preview, abrir "Autorizar pagamento de frete" e confirmar que a rota 423 aparece com seus pedidos.
- Migrações: nenhuma.
- Flags: nenhuma.
- Como reverter: voltar para a versão 1.14.4 no histórico.
