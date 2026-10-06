# Autorizar pagamento: só rotas com todos os pedidos expedidos

## Diagnóstico (rota 484)
A rota 484 tem um único pedido, o 4135756. Ele está faturado e tem borderô 32434, então atende à regra atual da tela (borderô em todos os pedidos). Porém:
- a rota não tem data de saída real (está com 01/01/3000);
- o pedido ainda aparece na consulta de pendentes do Sync ERP, que só traz pedidos com `DT_SAIDA_BORDERO` vazio. Ou seja, o pedido ainda não saiu.

## Nova regra
Uma rota só entra em "Autorizar pagamento de frete" quando todos os pedidos dela já tiverem saído. Quando pelo menos um pedido ainda aparecer como pendente de saída no ERP, a rota continua em "Rotas Pendentes".

## Como funciona
- A cada Sync ERP, o app marca os pedidos que vieram na consulta de pendentes como "sem saída".
- Quando um pedido não aparece mais nessa consulta, a marca é removida.
- A tela de autorização exclui rotas que tenham algum pedido marcado como "sem saída".
- Rotas Pendentes mantém essas rotas visíveis, mesmo com borderô completo.

## Detalhes técnicos
- Banco central: criar a coluna `orders.erp_sem_saida boolean` (pode ficar vazia, sem valor padrão). A mudança é compatível com a versão publicada. Vou entregar o script SQL para download, com o comando para desfazer (`drop column`).
- `src/lib/erp-sync.server.ts`: depois de buscar os pendentes, gravar `true` nos pedidos retornados e `false` nos pedidos que estão em rotas mas não vieram na consulta. Só faz isso quando a consulta terminar com sucesso, para não limpar as marcas por engano.
- `src/components/routes/RotasView.tsx`: incluir `erp_sem_saida` nos dados lidos e contar os pedidos sem saída no contexto do filtro.
- `autorizar-pagamento-frete.tsx`: exigir zero pedidos sem saída. `rotas.index.tsx`: manter a rota quando houver pedido sem saída.
- Versão 1.22.0 (MINOR) e entrada no CHANGELOG.

## Riscos
- Até rodar o primeiro Sync ERP depois da mudança, a marca estará vazia e a tela segue a regra atual.
- Rotas já confirmadas não mudam de status.

## Checklist para publicar
- Rodar o script SQL no banco central e depois um Sync ERP.
- No preview: confirmar que a rota 484 saiu da tela de autorização e aparece em Rotas Pendentes.
- Flags: nenhuma.
- Para reverter: voltar à versão anterior no histórico e remover a coluna, se quiser.
