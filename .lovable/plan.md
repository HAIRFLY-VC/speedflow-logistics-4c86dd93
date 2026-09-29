# Ajustar fonte dos cards de indicadores (sem quebra de linha)

## Problema
No valor "R$ 380.489,85" o número quebra em duas linhas dentro do card, porque o texto usa `break-words` e a fonte é grande demais para a largura do card (mesma classe no card "Pedidos pendentes sem rota").

## Classificação
PATCH (v1.8.2) — correção visual, sem mudança de comportamento nem de banco.

## Mudanças (apenas `src/components/routes/RotasView.tsx`)
Nos 4 cards de indicadores (Valor total, Peso, Pedidos, Entregas):
- Trocar `break-words` por `whitespace-nowrap` nos valores.
- Reduzir a fonte do valor: `text-base sm:text-xl` (era `text-lg sm:text-2xl`).

No card "Pedidos pendentes sem rota" (mesma linha de valores):
- Trocar `break-words` por `whitespace-nowrap` nos 4 valores (Mercadorias, Peso, Pedidos, Entregas) para manter o padrão consistente.

## Sem riscos
- Sem mudança em banco, integrações ou feature flags.

## Checklist para publicar
- Testar no preview: abrir Rotas Pendentes e conferir que "R$ 380.489,85" e os demais valores ficam em uma única linha, em largura estreita (mobile) e larga (desktop).
- Nenhuma migração aplicada; nenhuma flag a ligar.
- Reversão: voltar para a versão anterior no histórico do Lovable.
