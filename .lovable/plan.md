# Tudo que está no TESTE vai para a OFICIAL ao publicar (v1.6.0, MINOR)

## Por que o menu automático não funciona na oficial
Pela regra antiga do projeto, toda novidade nascia ligada só no TESTE e desligada na OFICIAL até você pedir a liberação. O menu lateral automático (e a conferência de pedidos da rota com o ERP) ainda estavam desligados na OFICIAL. Não é defeito.

## Nova regra (a partir de agora, sempre)
Ao publicar, a versão OFICIAL fica exatamente igual ao TESTE: nenhuma funcionalidade fica escondida só no teste.

## O que muda
1. Ligar na OFICIAL tudo que hoje está só no TESTE:
   - menu lateral que abre ao passar o mouse e recolhe ao sair (computador);
   - conferência dos pedidos da rota com o ERP em "Autorizar pagamento de frete".
2. Novas funcionalidades passam a nascer ligadas nos dois ambientes (sem esperar liberação).
3. Guardar essa regra na memória do projeto para nunca mais voltar ao padrão antigo.
4. Versão v1.6.0 e registro no histórico de mudanças.
5. O selo "TESTE · v…" continua aparecendo só no preview, para diferenciar os ambientes.

## Riscos
- A conferência de pedidos da rota passa a rodar também na oficial: ao abrir a tela ou o lápis, ela ajusta os pedidos da rota no app para igualar ao ERP (nada muda no ERP; rotas já pagas só mostram aviso). Como o banco já é o mesmo, isso já acontece hoje quando alguém usa o teste.
- Sem mudança no banco.

## Checklist para publicar
- No preview: passar o mouse sobre o menu (abre/recolhe) e abrir o lápis de uma rota em "Autorizar pagamento de frete".
- Clicar em Publish/Update: só então a OFICIAL recebe as funcionalidades.
- Reverter: versão anterior no histórico.

## Detalhes técnicos
- `src/config/features.ts`: `production: true` em `sidebarHoverExpand` e `reconciliarPedidosRota`; comentário da regra atualizado.
- Memória do projeto: preferência "flags sempre ligadas em produção; publicar = oficial igual ao teste" (substitui o item 4 da política original).
- `roadmap.md`, `src/config/version.ts`, `CHANGELOG.md`.
