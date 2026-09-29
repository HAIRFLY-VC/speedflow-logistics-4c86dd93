# Coluna "Pedidos por status": status em uma linha

## O que muda
Na tabela de rotas (Rotas Pendentes e Autorizar pagamento de frete), o status "06-SEPARACAO SOLICITADA" quebra em duas linhas. Vamos abreviá-lo para "06-SEP. SOLIC." e garantir que cada status apareça em uma única linha ao lado da contagem.

## Mudança técnica
- `src/components/routes/RotasView.tsx`:
  - Nova função `statusCurto(st)` que abrevia os rótulos longos vindos do ERP (começando por "06-SEPARACAO SOLICITADA" → "06-SEP. SOLIC."); demais statuses permanecem como estão.
  - Aplicada tanto na exibição (`StatusList`) quanto no filtro da coluna `pedidos_status`, para listagem e filtro ficarem consistentes.
  - Largura da coluna ajustada de 112px para 128px na tela de autorização, para caber o texto abreviado sem quebra.

## Versão
- PATCH → v1.7.1, com entrada no `CHANGELOG.md`.

## Riscos
- Nenhum: mudança apenas visual, sem banco nem integrações.

## Checklist para publicar
- No preview, conferir em Rotas Pendentes e em Autorizar pagamento de frete que os status aparecem em uma linha.
- Verificar que a tabela continua cabendo na largura da tela (sem rolagem lateral) na tela de autorização.
- Reversão: histórico do Lovable.
