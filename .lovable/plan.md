# "Ver tabela original": exibir o arquivo dentro do próprio app

## O que aconteceu
A correção anterior trocou o endereço externo por um link local temporário, mas o Edge (por política da empresa ou extensão) também bloqueia esse tipo de link quando ele abre numa **nova aba**. A tela agora mostra "está bloqueado" sem o nome do site, o que confirma isso.

## Correção (PATCH 1.30.2)
Parar de abrir nova aba. O arquivo passa a ser exibido numa **janela grande dentro do próprio app**:
- Cabeçalho com o nome do arquivo e os botões "Baixar" e "Fechar".
- PDF e imagens aparecem direto na janela.
- Outros formatos (Excel, Word etc.): a janela avisa que não é possível visualizar e oferece "Baixar".
- Se o navegador também bloquear a visualização dentro da janela, o botão "Baixar" continua funcionando como alternativa.
- Vale para o detalhe do CT-e e para a tela Tabelas de Frete (botões de visualizar). O botão "Baixar" das Tabelas de Frete continua baixando direto.

## Detalhes técnicos
- Novo componente `TabelaFreteArquivoViewer` (Dialog quase tela cheia) com um store simples (`useSyncExternalStore`) para abrir de qualquer lugar; montado uma vez em `AppShell`.
- `abrirArquivoTabelaFrete(path, nome, baixar)`: quando não é download, baixa via `storage.download()` e publica `{ blobUrl, nome, mime }` no store em vez de `window.open`. PDF renderizado em `<iframe>`/`<object>`; imagens em `<img>`; revoga a URL ao fechar.
- Download continua por `<a download>` com blob.
- Atualizar `version.ts` e `CHANGELOG.md` (1.30.2). Sem banco, sem flags.

## Checklist para publicar
- No Edge: CT-e 19780/2 → "Ver tabela original" abre a janela com o arquivo; testar "Baixar".
- Tabelas de Frete: visualizar e baixar.
- Reverter: voltar para 1.30.1 no histórico.
