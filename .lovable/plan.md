# Alargar coluna "Pedidos por status" sem quebra de linha

## O que muda
Na tabela de rotas, a coluna "Pedidos por status" mostra cada status quebrado em várias linhas (ex.: "06-SEPARACAO SOLICITADA" quebra). Vamos aumentar a largura da coluna para que cada status caiba em uma única linha ao lado da sua contagem.

## Mudança técnica
- `src/components/routes/RotasView.tsx`, coluna `pedidos_status`:
  - Largura fixa de **200px** nas duas telas (Rotas Pendentes e Autorizar pagamento de frete), em vez de 112px só na tela de autorização.
  - O status mais longo ("06-SEPARACAO SOLICITADA") mede cerca de 165px em fonte pequena; 200px garante uma linha sem quebra e espaço para a contagem à direita.

## Versão
- PATCH → v1.7.1, com entrada no `CHANGELOG.md`.

## Riscos
- Nenhum: mudança apenas visual, sem banco nem integrações.

## Checklist para publicar
- No preview, conferir em Rotas Pendentes e em Autorizar pagamento de frete que os status aparecem em uma linha.
- Verificar que a tabela continua cabendo na largura da tela (sem rolagem lateral) na tela de autorização.
- Reversão: histórico do Lovable.
