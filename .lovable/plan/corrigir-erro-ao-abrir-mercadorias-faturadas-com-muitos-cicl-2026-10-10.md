# Corrigir erro ao abrir Mercadorias faturadas com muitos ciclos (PATCH v1.39.3)

## Causa provável
Com 10 ciclos marcados, a tela dispara todas as consultas de uma vez (notas + provisões de frete de milhares de notas numa única chamada por ciclo). O servidor estoura o limite de tempo/recursos e devolve a página de erro "Worker threw exception", que a tela imprime inteira em vermelho e zera tudo.

## Correção
- Provisões consultadas em lotes menores (ex.: 1.000 notas por chamada), com no máximo 2–3 chamadas simultâneas.
- Ciclos carregados com concorrência limitada (3 por vez) em vez de todos juntos.
- Se o lote de provisões falhar, as notas continuam aparecendo (aviso discreto "provisionado indisponível"), em vez de zerar a tela.
- Se um ciclo falhar, mostrar os demais e avisar qual ciclo não carregou.
- Mensagem de erro amigável: nunca exibir HTML bruto do servidor.
- Aplicar a mesma limitação no painel Custo de Frete (mesma consulta multi-ciclo).

## Riscos
Somente leitura. Sem migração, sem flags, sem gravação no ERP.

## Detalhes técnicos
- `custo-frete-mercadorias.tsx`: helper `emLotes(itens, tamanho, concorrência)` para ciclos e NFs.
- `custo-frete.query.ts` (`custoFreteMultiQueryOptions`): mesma limitação.
- `src/lib/mensagem-erro.ts`: detectar resposta HTML/`<!DOCTYPE` e trocar por texto curto.
- version 1.39.3 + CHANGELOG.

## Checklist para publicar
- Marcar 10 ciclos e confirmar que carrega sem erro; totais iguais ao dashboard.
- Reverter: v1.39.2 no histórico.
