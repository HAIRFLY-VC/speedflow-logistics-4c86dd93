# Corrigir "Ver tabela original" bloqueado pelo navegador

## Causa
O botão abre em nova aba um link direto do servidor de arquivos. O Edge (ou uma extensão/política da empresa) bloqueia esse endereço externo (ERR_BLOCKED_BY_CLIENT), por isso aparece a tela "está bloqueado".

## Correção (PATCH 1.30.1)
- Em vez de abrir o link externo, o app baixa o arquivo pela própria sessão e o abre a partir do endereço do app (link local temporário). Nada de endereço externo na nova aba, então o bloqueio não ocorre.
- Visualizar: PDF e imagens abrem em nova aba; outros formatos (Excel etc.) são baixados com o nome original.
- Baixar: força download com o nome original.
- Vale para o detalhe do CT-e e para a tela Tabelas de Frete (mesmo helper compartilhado).
- Mensagem amigável se o arquivo não existir ou o navegador bloquear o pop-up.

## Detalhes técnicos
- `src/lib/tabela-frete-arquivo.ts`: trocar `createSignedUrl` + `window.open(url)` por `storage.from(bucket).download(path)` → `URL.createObjectURL(blob)`; abrir janela de forma síncrona antes do await (evita bloqueio de pop-up) e atribuir a URL depois; revogar a URL após ~60s.
- Atualizar `version.ts` e `CHANGELOG.md` (1.30.1). Sem banco, sem flags.

## Checklist para publicar
- Testar no Edge: CT-e 19780/2 → "Ver tabela original" e na tela Tabelas de Frete.
- Reverter: voltar para 1.30.0 no histórico.
