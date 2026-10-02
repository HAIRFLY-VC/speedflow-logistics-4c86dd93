# Abrir a impressão na mesma aba (v1.17.2 — PATCH)

## O que muda
- Clicar na impressora (Rotas Pendentes, Autorizar pagamento de frete e detalhe da rota) passa a abrir a impressão sempre na própria tela do app, tanto no teste quanto na oficial. Nenhuma aba nova é aberta, então a sessão é mantida e o login não é pedido.
- O botão "Voltar" da tela de impressão retorna à tela de onde o usuário veio.

## Detalhes técnicos
- `src/components/routes/RotasView.tsx` e `src/routes/_authenticated/rotas.$routeId.tsx`: trocar `openAppRoute(...)` por `navigate({ to: "/imprimir-rota/$routeId", params: { routeId } })`; remover `useRouter`/import não usados.
- `version.ts` para 1.17.2 e entrada no `CHANGELOG.md`.
- Verificar no preview, com sessão, que o clique abre a impressão sem cair no login.
- Sem mudanças no banco ou em integrações.
