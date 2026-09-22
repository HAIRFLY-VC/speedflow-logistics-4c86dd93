# Valor planejado do frete editável e persistente na tela Rotas Pendentes

## O que muda para você

1. **Digitar o valor planejado**: o campo de frete da rota fica sempre editável enquanto o pagamento não for confirmado. Ao sair do campo (clicar fora ou trocar de campo), o valor digitado é gravado automaticamente na rota como valor planejado — sem criar pagamento nem lançar nada no ERP/Bitrix.
2. **Valor permanece na tela**: como o valor planejado fica gravado, ele continua aparecendo na tela depois de recarregar a página, trocar de tela ou no próximo acesso — mesmo sem confirmação de pagamento.
3. **Cursor do botão**: quando o botão "Confirmar Pgto" estiver desabilitado (faltando borderô, valor zerado ou sem permissão), o mouse não mostra a "mãozinha" — mostra o cursor de proibido.
4. **Botão verde quando habilitado**: assim que o botão puder ser clicado (valor preenchido, todos os pedidos com borderô e permissão adequada), ele fica verde para deixar claro que está pronto.

## Detalhes técnicos

- `FreightInput` (`src/routes/_authenticated/rotas.index.tsx`):
  - Novo `onBlur` no campo: grava o valor digitado via `updateRoute` (`routes.total_freight`) somente quando o valor mudou e a rota ainda não está confirmada (ou o usuário é admin). Falha de gravação mostra aviso em português e mantém o valor digitado na tela.
  - Remove a restrição que escondia o campo para rotas já confirmadas de não-admin — o campo continua editável para admin; para os demais fica somente leitura (como hoje).
  - Botão: `disabled:` ganha `cursor-not-allowed`; quando habilitado, classes verdes (`bg-emerald-600 hover:bg-emerald-700 text-white`) para "Confirmar Pgto" e estilo neutro para "Reabrir / Lançar adicional".
- Nenhuma mudança de banco: o valor planejado usa a coluna `total_freight` já existente; a confirmação continua marcada por `frete_confirmado_em`, que só é preenchido no "Confirmar Pgto".

## Validação

- `bunx tsgo --noEmit` e build OK.
- Playwright em `/rotas`: digitar valor, recarregar a página e conferir que o valor continua exibido; botão desabilitado sem mãozinha e com cursor de proibido; botão verde quando habilitado.
