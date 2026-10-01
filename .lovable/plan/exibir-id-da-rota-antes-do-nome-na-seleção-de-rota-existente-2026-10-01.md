# Exibir ID da rota antes do nome na seleção de rota existente

Classificação: PATCH (1.16.4) — mudança visual, sem mudança de comportamento.

## O que muda

Na tela "Pedidos sem rota", aba **Rota existente** (modal de atribuição de rota), cada cartão de rota passará a exibir o ID da rota (ID do ERP, `erp_route_id`) antes do nome:

```text
Antes:  Rota 30/09/2026 ...
Depois: #423 · Rota 30/09/2026 ...
```

- Se o ID do ERP não existir para a rota, o cartão continua exibindo apenas o nome, sem "#".
- A busca por nome continua funcionando como hoje (o ID não entra no filtro).

## Alterações

1. `src/routes/_authenticated/pedidos-sem-rota.tsx`
   - No cartão da rota (bloco `rotasFiltradas.map(...)`), incluir o ID antes do nome: `<b>#{r.erp_route_id}</b> · {nome}` quando `r.erp_route_id` estiver presente.

2. `src/config/version.ts` → `1.16.4` e entrada em `CHANGELOG.md`.

## Impacto e riscos

- Sem alteração de banco, migração ou flags.
- Sem risco para a versão publicada; reversão pelo histórico de versões.

## Checklist para publicar

- No preview, abrir "Pedidos sem rota", selecionar pedidos e conferir que cada rota da aba "Rota existente" mostra o ID antes do nome.
- Conferir que rotas sem ID ERP não exibem "#" solto.
- Publicar para refletir na versão oficial.
