# Aviso de tipo inválido + menu lateral automático (v1.1.0 — MINOR)

## 1. Aviso em vermelho quando o tipo do fretista não é F/T/P
Hoje, quando o cadastro no ERP tem uma natureza fora de EF/ET/EM (ex.: rota 420, RBLOG, natureza "FT"), a coluna "Tipo" mostra só um selo âmbar ou "—", sem explicação.

O que muda:
- Na listagem de rotas e na janela do lápis, aparece um texto vermelho abaixo das ações, no mesmo estilo do aviso de PIX:
  - Natureza fora do padrão: "Tipo do fretista inválido no ERP (natureza FT, código 204315). Ajuste a natureza no ERP para EF, ET ou EM e clique em "Consultar PIX no ERP"/"Sync ERP"."
  - Código não encontrado no cadastro: "Fretista código X não encontrado no cadastro do ERP."
- Um botão "Atualizar cadastro" (o mesmo "Consultar PIX no ERP") fica ao lado do aviso para trazer a correção do ERP na hora.
- O selo âmbar na coluna "Tipo" continua igual. Não vou transformar "FT" em nenhum tipo sem você pedir.
- Isso é só um aviso e não bloqueia a confirmação do pagamento. Se quiser que bloqueie, me avise.

## 2. Menu lateral abre e fecha sozinho no computador
- No computador, com o menu recolhido (só ícones), ele abre ao passar o mouse e volta a recolher quando o mouse sai (com uma pequena espera para não piscar).
- Ao abrir, o menu fica por cima da tela, sem empurrar a tabela, então a listagem não se reorganiza a cada passada do mouse.
- O botão "Comprimir/Expandir" continua funcionando: se você fixar o menu aberto, a abertura automática fica desligada.
- No celular nada muda.
- Tudo fica atrás de uma chave de funcionalidade: ligado no teste e desligado no oficial até você pedir para liberar.

## Detalhes técnicos
- `RotasView.tsx`: incluir em `mensagemPix`/`avisoPix` (ou num `avisoTipo` irmão) a checagem via `tipoFreteOf(r)` nulo + `naturezaDaRota(r)`; o botão usa o `ConsultarPixButton` que já existe, passando o código.
- `AppShell.tsx`: um estado `hoverOpen` com `onMouseEnter`/`onMouseLeave` (espera de ~150 ms na saída) no `Sidebar` quando `state === "collapsed"` e `!isMobile`; a largura expandida é aplicada por cima da tela (`fixed`/z-index) para não mover o conteúdo; os itens mostram o texto enquanto `hoverOpen`.
- `src/config/features.ts`: flag `sidebarHoverExpand` (test: true, production: false).
- Atualizar a versão em `version.ts` para 1.1.0 e registrar no CHANGELOG. Nenhuma migração de banco.
