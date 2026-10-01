## Bloquear novo envio do frete depois que ele já foi informado (PATCH 1.15.1)

Hoje, numa rota com frete já confirmado, o administrador ainda consegue escolher "Frete da rota" e usar "Confirmar e enviar" de novo. Com a mudança, ninguém mais poderá fazer isso: só será possível lançar valores adicionais.

### O que muda para o usuário
- Na janela de pagamento de uma rota com frete já informado:
  - O botão "Frete da rota" deixa de aparecer, inclusive para o administrador.
  - A janela já abre direto em "Valor adicional", e o botão vira "Lançar adicional".
  - O aviso passa a dizer: "O frete desta rota já foi informado. Só é possível lançar valores adicionais."
- Quem não pode lançar adicional (não é administrador nem gestor) vê o botão desativado, como já acontece hoje.

### Proteção também no servidor
- Ao gravar, o servidor recusa um novo "FRETE" se a rota já tiver um frete confirmado e mostra uma mensagem clara. Assim nada passa nem por uma tela aberta antes da mudança.

### Riscos
- Banco: nenhuma alteração. ERP e Bitrix: o fluxo do adicional continua igual.
- Se o frete foi lançado errado, não dará mais para corrigir pelo app. Será preciso corrigir direto no ERP ou criar depois uma função específica de estorno.

### Detalhes técnicos
- `PagamentoRotaDialog.tsx`: quando `jaConfirmado`, forçar `tipo = "ADICIONAL"` para todos, remover o botão "Frete da rota" e simplificar a condição de `disabled`.
- `rota-pagamento.server.ts` (gravação): se `tipo === "FRETE"` e já existir pagamento FRETE confirmado para a rota, lançar erro antes de chamar o ERP.
- Atualizar `version.ts` para 1.15.1 e registrar no CHANGELOG.

### Checklist para publicar
- No teste, abrir uma rota já confirmada como administrador e conferir que só aparece "Valor adicional".
- Lançar um adicional numa rota de teste e conferir que funciona.
- Nenhuma migração e nenhuma flag. Para desfazer, restaurar a versão anterior pelo histórico.
