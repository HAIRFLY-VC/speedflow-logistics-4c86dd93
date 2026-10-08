# Sem valor de provisionamento enquanto houver crítica

## Classificação
**PATCH — v1.27.4** (regra de exibição na tela "Autorizar pagamento de frete"; nenhum cálculo, banco ou integração muda).

## Situação atual
Rotas com crítica ainda mostram o valor estimado da tabela de frete ao lado da exclamação vermelha — na imagem, as rotas 392 (R$ 5.093,43) e 443 (R$ 708,98), ambas com provisionamento parcial. Como parte das entregas não foi calculada, o valor apresentado está incompleto e pode ser lido como o custo real da rota.

## O que muda
- Na tela **Autorizar pagamento de frete**, uma rota com **qualquer crítica pendente** passa a exibir apenas a exclamação vermelha, sem valor de provisionamento (a célula fica com "—" e o ícone).
- Enquanto a crítica existir, o valor também **não entra na ordenação** da coluna Frete (a rota conta como sem valor).
- Valores que **não** são estimativa continuam aparecendo: pagamento já confirmado e valor já gravado no app.
- A exclamação segue mostrando todos os motivos ao posicionar o mouse.
- A tela **Rotas Pendentes** não muda: lá o valor estimado continua aparecendo normalmente.
- Nenhuma crítica é removida do cálculo — só deixa de mostrar um número que ainda não é confiável.

## Onde (técnico)
- `src/components/routes/RotasView.tsx`:
  - Novo auxiliar `estimadoExibivel(r)`: devolve o total da simulação apenas quando a rota não tem crítica em `criticasProvisionamento` e as consultas de transportadoras/tabelas/vínculos já terminaram (evita o valor aparecer e sumir durante o carregamento). Fora da tela de autorização (`permitirConfirmacao === false`), devolve o total normalmente.
  - `freteOf` (fallback da estimativa) passa a usar esse auxiliar, em vez de `estimativas.get(r.id)?.total`.
  - A célula Frete recebe `estimate={...}` e `key={...}` pelo mesmo auxiliar, então o selo "est." e o campo numérico ficam vazios quando há crítica.
  - `estimativas` continua alimentando o cálculo das críticas (nenhuma mudança em `simularRota` nem em `frete-simulacao.ts`).
- `src/config/version.ts`: `1.27.3` → `1.27.4`.
- `CHANGELOG.md`: entrada `## [1.27.4] - 2026-10-08`, item "Alterado".
- Sem migração, sem nova chamada ao ERP, sem mudança de flags ou permissões.

## Checklist para publicar
- Abrir "Autorizar pagamento de frete": rotas 392 e 443 mostram só a exclamação vermelha, sem valor; rotas sem crítica mantêm o valor estimado ("est.").
- Conferir que rotas com pagamento confirmado continuam com o valor e o selo "Pgto confirmado".
- Abrir "Rotas Pendentes" e confirmar que o valor estimado continua aparecendo.
- Passar o mouse sobre a exclamação para conferir os motivos.
- Nenhuma migração pendente no banco compartilhado.
- Reverter: publicar a versão anterior do histórico do Lovable (nenhum dado alterado).
