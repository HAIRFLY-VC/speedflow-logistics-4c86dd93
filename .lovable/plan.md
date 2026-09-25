# Corrigir o PIX do Bruno

## Objetivo
Fazer o cadastro do Bruno Jefferson da Silva (código ERP 205630) voltar a carregar a chave PIX existente no ERP e remover o bloqueio incorreto na rota 416.

## Alterações
1. Substituir a busca do PIX pela consulta exata fornecida, mantendo a comparação do campo `DBA_CONT_CARGO` com o valor `PIX` preenchido no formato fixo do ERP.
2. Aplicar a mesma consulta nos três caminhos que alimentam o cadastro:
   - atualização completa pela tela Transportadoras;
   - atualização automática por código;
   - sincronização periódica do ERP.
3. Manter a regra informada: usar `DBA_CONT_CONTATO` quando preenchido e `DBA_CONT_EMAIL` quando o contato estiver em branco.
4. Executar novamente a atualização de responsáveis e conferir no espelho que o código 205630 recebeu o PIX.
5. Validar em “Autorizar pagamento de frete” que a rota 416 mostra o PIX do Bruno e não exibe mais “Fretista sem PIX cadastrado”.

## Validação
- Conferir compilação e verificações de tipos.
- Testar visualmente a rota 416 após a atualização.
- Confirmar que os demais fretistas continuam sendo sincronizados normalmente.

## Detalhes técnicos
A consulta atual usa `UPPER(TRIM(DBA_CONT_CARGO)) = 'PIX'`, mas isso não corresponde literalmente à consulta solicitada. Ela será trocada pela comparação exata com o campo de tamanho fixo do ERP em todos os pontos, evitando resultados diferentes entre as sincronizações.
