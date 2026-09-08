# Corrigir cabeçalho fixo em "Entregas em aberto"

## Problema

O quadro da tabela hoje só rola na horizontal, e quem rola na vertical é a página inteira. Por isso o cabeçalho, mesmo marcado como fixo, acompanha a página e some da tela.

## Correção

Fazer a rolagem vertical acontecer dentro do próprio quadro da tabela:

- O quadro passa a ter altura limitada à área visível da tela (descontando cabeçalho da página, filtros e rodapé de totais) e rolagem própria nos dois sentidos.
- Com isso o cabeçalho das colunas gruda no topo do quadro e permanece sempre visível enquanto as linhas rolam por baixo.
- Fundo sólido e sombra no cabeçalho mantidos, para as linhas não aparecerem por trás.
- Os controles acima (busca, filtros, exportar, visões) e o rodapé de totais continuam sempre visíveis.

## Detalhes técnicos

Em `src/routes/_authenticated/entregas-abertas.tsx`, o wrapper `overflow-x-auto` da tabela vira `overflow-auto` com `max-h-[calc(100dvh-260px)]` (ajustado por breakpoint no mobile). As células de `TableHead` mantêm `sticky top-0 z-20 bg-card`, agora ancoradas nesse contêiner de rolagem.

## Verificação

Conferir no preview, com rolagem para baixo, que a linha de títulos permanece visível e opaca sobre as linhas de dados.
