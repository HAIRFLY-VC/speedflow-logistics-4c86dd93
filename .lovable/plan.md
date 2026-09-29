# Card de pedidos pendentes sem rota

## Classificação e versão
- **MINOR:** nova funcionalidade compatível.
- Atualizar a versão de **1.7.4 para 1.8.0** e registrar no `CHANGELOG.md`.
- Sem migração, alteração de dados ou chamada adicional ao ERP.

## O que será feito
- Adicionar em **Rotas Pendentes** um único card clicável chamado **Pedidos pendentes sem rota**.
- Exibir no mesmo card:
  - valor total das mercadorias;
  - peso total;
  - quantidade de pedidos;
  - quantidade de entregas.
- Calcular entregas como clientes distintos, seguindo a regra já usada na tela **Pedidos sem rota**.
- Ao clicar, abrir a tela **Pedidos sem rota**.
- Quando houver ao menos um pedido, alternar suavemente o fundo entre o padrão e vermelho claro para chamar atenção.
- Quando não houver pedidos, manter o card sem animação e com todos os totais zerados.
- Respeitar a preferência de movimento reduzido do dispositivo, mantendo destaque vermelho estático nesse caso.
- Mostrar estado de carregamento e uma mensagem discreta caso os totais não possam ser consultados.

## Detalhes técnicos
- Reutilizar uma consulta paginada e compartilhada para que o card e a tela **Pedidos sem rota** usem os mesmos filtros e o mesmo limite atual de 20.000 registros.
- Exibir o card somente em **Rotas Pendentes**, sem alterar **Autorizar pagamento de frete**.
- Usar os componentes e tokens visuais existentes, sem cores fixas no código da tela.
- Criar a flag da funcionalidade ativa em teste e produção, conforme a política atual de publicação.
- Validar em computador e celular, incluindo clique, totais, animação e ausência de quebra no conteúdo.

## Risco e reversão
- **Risco baixo:** é uma consulta de leitura e uma mudança visual; não altera pedidos, rotas, banco ou integrações.
- Reversão: retornar à versão anterior pelo histórico do Lovable; não há SQL para desfazer.

## Checklist para publicar
- Conferir se os quatro totais coincidem com a tela **Pedidos sem rota**.
- Conferir que o card pulsa somente quando existem pedidos sem rota.
- Conferir que o clique abre **Pedidos sem rota**.
- Conferir a disposição em computador e celular.
- **Migrações aplicadas:** nenhuma.
- **Flags após publicar:** nenhuma ação; ficará ativa também na versão oficial.
