# Corrigir largura da listagem de Rotas Pendentes

**Classificação:** PATCH — versão proposta **1.9.2**.

## Diagnóstico confirmado

- No print enviado, a coluna de ações à direita está parcialmente cortada e algumas células dos registros estão excessivamente comprimidas.
- A tela usa tabela de largura fixa com medidas definidas por coluna e oculta o conteúdo excedente. A soma e a distribuição atuais não reservam espaço suficiente para todas as colunas na largura disponível.

## Alterações

1. Rebalancear exclusivamente as larguras da tabela de **Rotas Pendentes**, reservando largura fixa para código, tipo, números e ação, e distribuindo o restante entre nome da rota, fretista/transportadora e pedidos por status.
2. Garantir que a coluna final de edição permaneça totalmente visível, sem rolagem lateral.
3. Manter cada status em uma única linha e evitar corte dos valores numéricos; permitir quebra controlada somente em textos longos, como nome da rota e fretista/transportadora.
4. Preservar as datas completas nas linhas totalizadoras e a expansão automática dos grupos.
5. Validar no tamanho de tela do print e em uma largura menor de computador, conferindo cabeçalho, linhas, totalizadores e botão de edição.
6. Atualizar a versão para **1.9.2** e registrar a correção no histórico.

## Impacto e segurança

- Nenhuma alteração no banco de dados, permissões, integrações ou regras de negócio.
- Nenhuma nova flag; a correção será igual em teste e produção após publicar.
- A tela de autorização de pagamento e as demais tabelas manterão seu comportamento atual.

## Checklist para publicar

- Conferir no preview que todas as colunas e o lápis aparecem por inteiro, sem barra horizontal.
- Confirmar que status, datas e valores não são cortados.
- Migrações aplicadas: nenhuma.
- Flags para ligar após publicar: nenhuma.
- Reversão: restaurar a versão **1.9.1** pelo histórico do Lovable.
