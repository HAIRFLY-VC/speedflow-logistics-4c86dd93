# Card "Pedidos pendentes sem rota" — alinhar coluna direita

## Objetivo
No card pulsante "Pedidos pendentes sem rota" (tela Rotas Pendentes), os títulos e valores de "Pedidos" e "Entregas" ficam colados nos valores de "Mercadorias" e "Peso" da coluna da esquerda. O usuário quer essa coluna da direita posicionada mais à direita para melhorar a leitura.

Classificação: **PATCH** (ajuste visual, sem mudança de comportamento).

## Mudança
Arquivo: `src/components/routes/RotasView.tsx` (card em ~linhas 2195-2236)

- Aumentar o espaçamento horizontal da grade do card (`gap-x-3` → `gap-x-8`).
- Alinhar à direita os blocos "Pedidos" e "Entregas" (`text-right` nos dois `<div>` da coluna direita), mantendo "Mercadorias" e "Peso" alinhados à esquerda.

Resultado: os rótulos e valores de Pedidos/Entregas ficam encostados na borda direita do card, com separação visual clara da coluna esquerda.

## Riscos
- Nenhum risco funcional; apenas CSS do card. Não afeta banco, integrações ou a versão publicada.

## Versionamento
- `src/config/version.ts`: bump PATCH (ex.: 1.28.1).
- `CHANGELOG.md`: entrada "Alterado — card de pedidos sem rota: coluna Pedidos/Entregas alinhada à direita para melhor leitura".

## Validação
- Typecheck/build.
- Verificação visual no preview da tela Rotas Pendentes (card visível quando há pedidos sem rota).

## Checklist para publicar
- Testar no preview: abrir Rotas Pendentes com pedidos sem rota e conferir o alinhamento.
- Sem migrações de banco.
- Sem feature flags a ligar.
- Reversão: voltar para a versão anterior no histórico do Lovable.
