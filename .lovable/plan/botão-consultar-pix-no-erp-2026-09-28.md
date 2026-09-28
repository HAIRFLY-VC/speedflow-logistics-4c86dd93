# Botão "Consultar PIX no ERP"

## O que muda para o usuário
- Onde aparece o aviso "Fretista sem PIX cadastrado no ERP" (listagem de Autorizar pagamento de frete e janela do lápis), surge um link/botão **"Consultar PIX no ERP"**.
- Ao clicar, o app busca de novo no ERP o cadastro daquele fretista (código da rota, ex.: 204994), atualiza o PIX guardado no app e recalcula o aviso e o botão "Confirmar Pgto" na hora.
- Enquanto consulta, mostra "Consultando ERP..."; ao final, avisa "PIX encontrado" ou "O ERP continua sem PIX para o fretista (código X)". A chave PIX nunca é mostrada.
- A mensagem vermelha deixa de mandar o usuário para a tela Transportadoras.

## Detalhes técnicos
- Reusar `sincronizarResponsaveisPorCodigo` (rota-erp.functions.ts) com `[cod_erp]`, que já consulta o ERP com a query de PIX e grava em `erp_responsaveis`.
- `RotasView.tsx` (área do `FreightInput`, ~linha 433-454): botão quando `pix?.bloqueio === "SEM_PIX"`; após sucesso, invalidar as queries de responsáveis/situação do PIX.
- `PagamentoRotaDialog.tsx` (~linha 320): mesmo botão; após sucesso, refazer a prévia de pagamento.
- `pix-controle.server.ts`: ajustar texto de `mensagemBloqueioPix` ("...cadastre o contato PIX no ERP e clique em Consultar PIX no ERP").
- Verificação: tsgo e Playwright na rota do fretista 204994.
