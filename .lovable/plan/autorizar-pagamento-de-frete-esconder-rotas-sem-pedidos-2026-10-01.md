# Autorizar pagamento de frete: esconder rotas sem pedidos

## Mudança
Na tela "Autorizar pagamento de frete", hoje uma rota sem nenhum pedido vinculado no app aparece quando tem ID do ERP e borderô emitido (regra criada para a rota 423, que tinha pedidos só no ERP).

Nova regra: a rota só aparece se tiver ao menos um pedido associado (`route_orders > 0`). Rotas sem pedidos são excluídas da tela — inclusive as com borderô emitido. Se depois a auditoria importar os pedidos, a rota volta a aparecer normalmente.

## O que muda no código
- `src/components/routes/RotasView.tsx` (consulta de rotas da tela, linhas ~952-958): remover a exceção `erp_route_id + bordero_emitido_em`, mantendo só rotas com pedidos vinculados.
- Atualizar `src/config/version.ts` para 1.15.2 e adicionar entrada em `CHANGELOG.md` (PATCH: correção de exibição, sem mudança de fluxo).

## Impacto e riscos
- Sem migração de banco e sem risco para a versão publicada (mudança só de filtro na tela).
- Rota com borderô no ERP mas pedidos ainda não importados fica invisível até a auditoria importar os pedidos — depois disso ela volta a ser exibida.
- Nada muda no fluxo de confirmação de pagamento.

## Checklist para publicar
- No preview: conferir que rotas sem pedidos (ex.: rota 423 antes da importação) não aparecem; que a 423 aparece após importar pedidos; que a confirmação segue funcionando.
- Migrações aplicadas: nenhuma.
- Flags: nenhuma a ligar.
- Reverter: versão anterior no histórico do Lovable (mudança só de código, sem SQL).
