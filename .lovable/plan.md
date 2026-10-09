# "Ver tabela original": baixar o arquivo em vez de abrir

## O que aconteceu
O Edge bloqueia a abertura do arquivo em nova aba (mesmo com link local), mostrando "está bloqueado".

## Correção (PATCH 1.30.2)
- Os botões "Ver tabela original" (detalhe do CT-e) e de visualizar arquivo (Tabelas de Frete) passam a **baixar o arquivo direto na área de downloads**, com o nome original. Nenhuma aba nova é aberta.
- O botão passa a se chamar "Baixar tabela original".
- Mensagem amigável se o arquivo não existir.

## Detalhes técnicos
- `src/lib/tabela-frete-arquivo.ts`: `abrirArquivoTabelaFrete` sempre faz `storage.download()` + `<a download>` com blob; remove o `window.open`.
- Ajustar textos dos botões em `CteDetailView.tsx`.
- `version.ts` e `CHANGELOG.md` (1.30.2). Sem banco, sem flags.

## Checklist para publicar
- No Edge: CT-e 19780/2 → botão baixa o arquivo; Tabelas de Frete idem.
- Reverter: voltar para 1.30.1 no histórico.
