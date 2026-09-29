# Histórico de status do pedido para todos os usuários (v1.5.2, PATCH)

## O que foi verificado
- A consulta do histórico não tem nenhuma restrição por tipo de usuário: qualquer pessoa logada pode usá-la.
- A funcionalidade está **ligada só no ambiente de TESTE** e desligada na versão publicada (OFICIAL), como toda funcionalidade nova.
- Provável causa: o administrador usa o TESTE (onde funciona) e os demais usuários usam a versão OFICIAL, onde o código do pedido não é clicável.

## O que muda
1. Ligar o histórico de status do pedido também na versão OFICIAL.
2. Atualizar versão para v1.5.2 e registrar no histórico de mudanças.

## Riscos
- Só leitura no ERP; nada é gravado. Sem mudança no banco.

## Checklist para publicar
- No preview, entrar com um usuário não administrador e clicar num código de pedido para ver o histórico.
- Depois clicar em Publish/Update: só então os usuários da versão OFICIAL passam a ver.
- Reverter: desligar a chave de novo ou voltar à versão anterior no histórico.

## Detalhes técnicos
- `src/config/features.ts`: `historicoStatusPedido: { test: true, production: true }`.
- `src/config/version.ts` e `CHANGELOG.md`.
