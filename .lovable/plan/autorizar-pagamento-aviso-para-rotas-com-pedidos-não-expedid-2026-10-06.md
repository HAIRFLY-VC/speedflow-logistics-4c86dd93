# Autorizar pagamento: aviso para rotas com pedidos não expedidos

## Diagnóstico (rota 484)
A rota 484 tem um único pedido, o 4135756. Ele está faturado e tem borderô 32434, então atende à regra atual da tela. Porém, o pedido ainda aparece na consulta de pendentes do Sync ERP, que só traz pedidos com `DT_SAIDA_BORDERO` vazio. Ou seja, ele ainda não saiu. A data da rota também é provisória (01/01/3000).

## Nova regra
- **Nenhum pedido expedido:** a rota não aparece em "Autorizar pagamento de frete" e continua em "Rotas Pendentes". É o caso da rota 484.
- **Pelo menos um pedido expedido, mas não todos:** a rota aparece na tela de autorização com um aviso de "Expedição incompleta". O botão de confirmar o pagamento fica bloqueado até que:
  - os pedidos não expedidos sejam excluídos da rota; ou
  - todos os pedidos sejam expedidos.
- **Todos os pedidos expedidos:** a rota segue o fluxo normal.

## O que o usuário vê
- Na lista: um ícone de alerta na rota, com uma mensagem ao passar o mouse, por exemplo: "2 de 6 pedidos ainda não saíram".
- No modal de pagamento, aberto pelo lápis ou por "Confirmar Pgto":
  - um aviso de expedição incompleta;
  - a lista dos pedidos sem saída, com código do cliente, cliente, agenda, filial e valor;
  - as mesmas ações de exclusão já usadas em "Rota incompleta": excluir um pedido ou "Excluir todos".
- O botão de confirmar fica desativado enquanto houver pedido sem saída.

## Detalhes técnicos
- Banco central: criar a coluna `orders.erp_sem_saida boolean` (pode ficar vazia). A mudança é compatível com a versão publicada. Vou entregar o script para download, com o comando para desfazer.
- `erp-sync.server.ts`: depois que a consulta de pendentes terminar com sucesso, gravar `true` nos pedidos retornados e `false` nos pedidos que estão em rotas mas não vieram na consulta.
- `RotasView.tsx`: ler `erp_sem_saida` e acrescentar `semSaida` ao contexto do borderô. Na autorização, exigir `semSaida < total`. Rotas Pendentes também mantém a rota quando `semSaida === total`. Adicionar o ícone de alerta.
- `rota-pagamento.server.ts` e `PagamentoRotaDialog.tsx`: retornar os pedidos sem saída, mostrar a crítica e bloquear a confirmação. O servidor também recusa a confirmação, não só a tela.
- Versão 1.22.0 (MINOR) e entrada no CHANGELOG.

## Riscos
- Até o primeiro Sync ERP depois da mudança, a marca estará vazia e as rotas seguirão a regra atual.
- Rotas já confirmadas não mudam.

## Checklist para publicar
- Rodar o script no banco central e depois um Sync ERP.
- No preview:
  - a rota 484 sai da tela de autorização;
  - uma rota com expedição parcial mostra o aviso e fica com o botão bloqueado;
  - depois de excluir os pedidos sem saída, o botão é liberado.
- Flags: nenhuma.
- Para reverter: voltar à versão anterior no histórico do Lovable. A coluna nova pode ficar no banco sem causar problema.
