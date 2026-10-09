# Deixar "01-DIGITADO" e "02-CRITICADO" em vermelho

## O que muda

Os dois status críticos do ERP passam a aparecer em **fonte vermelha** em todas as telas que hoje os mostram na cor normal. A tela da sua imagem (detalhe da rota, coluna **Status**) é a principal.

| Tela | Situação hoje | Depois |
|---|---|---|
| Detalhe da rota — coluna Status da lista de pedidos por cliente | preto | **vermelho** |
| Pedidos sem rota — Status dentro do grupo de cada cliente (computador e celular) | preto | **vermelho** |
| Impressão / PDF da rota — coluna Status | preto | **vermelho** (no modo econômico continua preto, porque esse modo imprime tudo em preto para economizar tinta) |
| Rotas Pendentes — coluna "Pedidos por status" | já vermelho | igual, sem mudança visual |

Os demais status (03.1-\*LIB-CRITICADO, 06-SEP. SOLIC., 09-CONFERIDO, 10-FATURADO, 11-EXPEDIDO…) seguem na cor normal. A regra vale só para esses dois rótulos, comparando sem diferenciar maiúsculas/minúsculas e ignorando espaços extras.

Nada muda em valores, filtros, botões ou no banco — é apenas cor de texto.

## Checklist para publicar

- **Testar no preview:** abrir uma rota com pedido 01-DIGITADO ou 02-CRITICADO e ver a coluna Status; abrir Pedidos sem rota; gerar a prévia de impressão de uma rota.
- **Banco:** nenhuma alteração.
- **Chaves para ligar:** nenhuma.
- **Reverter:** voltar para a v1.37.1 no histórico do Lovable.

## Classificação da mudança

**PATCH — v1.37.2** (correção visual, sem mudança de comportamento). `src/config/version.ts` e `CHANGELOG.md` são atualizados.

## Detalhes técnicos

- Criar `src/lib/erp-status.ts` com a lista dos status críticos (`01-DIGITADO`, `02-CRITICADO`) e um utilitário `isStatusCriticoErp(status)` (normaliza com `trim().toUpperCase()`).
- Aplicar a classe `text-destructive` — token semântico do tema, já usado hoje em Rotas Pendentes, portanto compatível com modo claro/escuro e sem cor fixa no código — nos pontos:
  - `src/routes/_authenticated/rotas.$routeId.tsx` (célula da coluna Status, ~linha 913);
  - `src/routes/_authenticated/pedidos-sem-rota.tsx` (parágrafo do status, ~linha 917);
  - `src/components/print/RotaPrintDocument.tsx` (célula da coluna Status, ~linha 274).
- `src/components/routes/RotasView.tsx` mantém exatamente o mesmo visual: a constante privada `STATUS_VERMELHO`/`statusVermelho` é substituída pelo utilitário compartilhado, para a regra ficar em um único lugar.
- No PDF, o modo econômico (`data-eco="true"`) tem uma regra que força `color: #000` em todo o conteúdo; ela permanece como está.
