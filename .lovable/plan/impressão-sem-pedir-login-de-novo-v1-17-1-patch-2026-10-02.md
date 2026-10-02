# Impressão sem pedir login de novo (v1.17.1 — PATCH)

## Causa
Os botões de impressão abrem a página com `window.open` direto. Dentro do preview do editor, a nova aba não enxerga a sessão e cai no login. O app já tem um utilitário que resolve isso para o CT-e, mas a impressão não o usa.

## Correção
- Usar o mesmo utilitário nos dois pontos de impressão: fora do preview (app oficial) abre em nova aba com a sessão mantida; dentro do preview abre a impressão na própria tela, sem pedir login.
- O botão "Voltar" da tela de impressão já retorna à tela anterior.

## Detalhes técnicos
- `src/components/routes/RotasView.tsx` (linha ~1916) e `src/routes/_authenticated/rotas.$routeId.tsx` (linha ~476): trocar `window.open(...)` por `openAppRoute(router, \`/imprimir-rota/${id}\`)` de `src/lib/open-in-tab.ts`, com `useRouter()`.
- `version.ts` para 1.17.1 e entrada no `CHANGELOG.md`.
- Sem mudanças no banco ou em integrações.
