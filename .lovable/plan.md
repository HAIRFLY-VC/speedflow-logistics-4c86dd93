# Liberar o menu lateral automático na versão oficial (v1.5.3, PATCH)

## Por que não funciona na oficial
Pela regra do projeto, toda novidade nasce ligada só no TESTE e desligada na OFICIAL até você pedir para liberar. O menu que abre ao passar o mouse e recolhe ao sair ainda está desligado na OFICIAL. Não é defeito.

## O que muda
1. Ligar o menu lateral automático também na versão OFICIAL (só computador; celular continua igual).
2. Atualizar versão para v1.5.3 e registrar no histórico de mudanças.

## Riscos
- Só muda a tela; sem banco, ERP ou integrações.

## Checklist para publicar
- No preview, passar o mouse sobre o menu (abre) e tirar (recolhe).
- Clicar em Publish/Update: só então a versão OFICIAL passa a ter o menu automático.
- Reverter: desligar a chave de novo ou voltar à versão anterior no histórico.

## Detalhes técnicos
- `src/config/features.ts`: `sidebarHoverExpand: { test: true, production: true }`.
- `src/config/version.ts` e `CHANGELOG.md`.
