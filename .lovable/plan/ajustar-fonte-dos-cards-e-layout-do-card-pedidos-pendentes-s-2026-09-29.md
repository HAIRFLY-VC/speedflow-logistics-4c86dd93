# Ajustar fonte dos cards e layout do card "Pedidos pendentes sem rota"

## Problema
1. O valor "R$ 380.489,85" quebra em duas linhas dentro dos cards de indicadores (mesma classe no card "Pedidos pendentes sem rota"), porque o texto usa `break-words` e a fonte é grande para a largura do card.
2. No computador, o card "Pedidos pendentes sem rota" empilha os 4 valores em uma única coluna (`lg:grid-cols-1`), aumentando a altura dele — e por consequência a linha inteira de cards.

## Classificação
PATCH (v1.8.2) — correção visual, sem mudança de comportamento, banco ou feature flags.

## Mudanças (apenas `src/components/routes/RotasView.tsx`)

### Card "Pedidos pendentes sem rota" (formato da imagem enviada)
- Conteúdo em grade **2x2 em todas as larguras** (remover `lg:grid-cols-1`): primeira linha Mercadorias | Pedidos, segunda linha Peso | Entregas (reordenar para Mercadorias, Pedidos, Peso, Entregas, como no mock).
- Título em vermelho com a seta à direita, como já está.
- Valores com `whitespace-nowrap` (sem `break-words`) e fonte reduzida (`text-sm`), para caber em coluna estreita sem quebra.
- Card mantém a altura padrão dos demais (o conteúdo 2x2 cabe nessa altura); sem alterar altura dos outros cards.

### Os 4 cards de indicadores (Valor total, Peso, Pedidos, Entregas)
- Trocar `break-words` por `whitespace-nowrap` nos valores.
- Reduzir a fonte do valor: `text-base sm:text-xl` (era `text-lg sm:text-2xl`).

## Sem riscos
- Sem mudança em banco, integrações ou feature flags (`cardPedidosSemRota` continua igual).

## Checklist para publicar
- Testar no preview: abrir Rotas Pendentes e conferir que "R$ 380.489,85" e os demais valores ficam em uma única linha, em largura estreita (mobile) e larga (desktop).
- Conferir o card "Pedidos pendentes sem rota" em formato 2x2 (Mercadorias | Pedidos / Peso | Entregas), com a mesma altura dos outros cards, fundo pulsando em vermelho e clique indo para "Pedidos sem rota".
- Nenhuma migração aplicada; nenhuma flag a ligar.
- Reversão: voltar para a versão anterior no histórico do Lovable.
