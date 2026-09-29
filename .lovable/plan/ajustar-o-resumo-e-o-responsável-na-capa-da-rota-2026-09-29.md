# Ajustar o resumo e o responsável na capa da rota

**Classificação:** PATCH — versão proposta **1.9.3**.

## Alterações

- Ampliar o card **Resumo** da capa da rota para exibir também:
  - percentual do frete sobre o valor total das mercadorias;
  - quantidade de pedidos;
  - peso total em kg.
- Calcular o percentual como `frete ÷ valor total × 100`; quando não houver valor de mercadorias, exibir um traço para evitar divisão inválida.
- Somar o peso dos pedidos já associados à rota e manter a quantidade baseada nesses mesmos registros.
- Remover da visualização da capa o campo **Fretista interno** e seu seletor.
- Manter a alteração do responsável somente no fluxo aberto pelo botão **Editar**, onde o responsável já pode ser selecionado e salvo no ERP.
- Atualizar a versão para **1.9.3** e registrar a mudança no changelog.

## Validação

- Conferir no computador que os seis indicadores do resumo aparecem completos: paradas, pedidos, valor total, peso total, frete e percentual do frete.
- Conferir uma rota com valor total zero para validar a apresentação segura do percentual.
- Confirmar que **Fretista interno** não aparece na visualização e que o responsável continua disponível no botão **Editar**.
- Validar a tela também em largura móvel e confirmar que não há erros no preview.

## Impacto e publicação

- **Banco compartilhado:** nenhuma migração e nenhuma alteração de dados.
- **Integrações:** nenhuma mudança no ERP ou Bitrix; apenas apresentação e acesso ao controle já existente.
- **Flags:** nenhuma flag nova; a alteração seguirá para a versão oficial ao publicar.
- **Reversão:** restaurar a versão **1.9.2** pelo histórico do Lovable; não há SQL de reversão.
