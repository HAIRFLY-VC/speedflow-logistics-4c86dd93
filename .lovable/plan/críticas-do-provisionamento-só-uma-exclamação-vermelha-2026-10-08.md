# Críticas do provisionamento: só uma exclamação vermelha

## Classificação
**PATCH — v1.27.3** (mudança visual na listagem de "Autorizar pagamento de frete", sem mudança de cálculo, banco ou integração).

## O que muda hoje
Na coluna **Frete (R$)**, cada crítica do provisionamento é exibida como uma linha de texto em âmbar/laranja abaixo do valor. Com duas críticas, o texto ocupa duas linhas e invade a coluna "Distância (km)".

## O que será feito
- A célula Frete passa a mostrar **um único ícone de exclamação em vermelho** (círculo com "!") quando houver qualquer crítica da rota.
- O texto das críticas **deixa de aparecer na tela** e continua disponível **no popup ao posicionar o mouse** sobre a exclamação, com o título "Críticas do provisionamento" e a lista completa (uma por linha).
- Nenhuma crítica é removida do cálculo: a mesma lista de motivos (transportadora não identificada, tabela vigente ausente, entrega sem município, praça não encontrada, provisionamento parcial) continua sendo gerada.
- Como o ícone é pequeno, o transbordamento para a coluna "Distância (km)" desaparece.
- O selo "est." e o valor estimado em itálico permanecem como estão; avisos de PIX e de "Rota incompleta" também não mudam.

## Onde (técnico)
- `src/components/routes/RotasView.tsx`: `avisoProvisionamentoEl` (linhas ~571-590) troca o bloco de `<span>` âmbar por um único `<CircleAlert>` (lucide-react) com `text-destructive`, `cursor-help`, `aria-label="Críticas do provisionamento"` e o mesmo `Tooltip`/`TooltipContent` atual. Import de `CircleAlert` adicionado (o `AlertTriangle` existente segue em uso no badge de auditoria).
- `src/config/version.ts`: `1.27.2` → `1.27.3`.
- `CHANGELOG.md`: entrada `## [1.27.3] - 2026-10-08` com item "Alterado".
- Sem migração, sem nova chamada ao ERP, sem mudança de flags ou permissões.

## Checklist para publicar
- Abrir "Autorizar pagamento de frete" no preview: rotas com crítica mostram apenas a exclamação vermelha; passar o mouse mostra todas as mensagens; a coluna "Distância (km)" volta a ficar limpa.
- Conferir que rotas sem crítica seguem sem ícone e que o valor estimado ("est.") continua aparecendo.
- Nenhuma migração pendente no banco compartilhado.
- Reverter: publicar a versão anterior do histórico do Lovable (nenhum dado alterado).
