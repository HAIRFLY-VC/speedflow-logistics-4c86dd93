# PIX obrigatório para confirmar o pagamento do frete

## O que muda para o usuário
- **Botão "Confirmar Pgto" sem PIX:** em rotas de fretista sem PIX cadastrado no ERP, o botão continua aparecendo, mas desabilitado. Logo abaixo dele aparece em vermelho: "Fretista sem PIX cadastrado no ERP. Cadastre o contato PIX do fretista (código X) e clique em Atualizar cadastro."
- **Janela de confirmação:** mostra o PIX que vai receber o pagamento. Se o PIX não for encontrado, a confirmação é recusada com essa mesma mensagem, mesmo que a tela esteja desatualizada.
- **Tarefa no Bitrix:** logo abaixo do "Resumo por filial de faturamento", entra a instrução de depósito:
  ```text
  Instrução de pagamento
    Depositar via PIX: <chave>
    Favorecido: <razão social> (código <cod>)
    Valor total: R$ X
    Data de pagamento: dd/mm/aaaa
  ```
  Isso também vale para o lançamento de valor adicional.
- **Rotas 419 e 421:** o script do PIX já foi rodado. Depois de "Atualizar cadastro", a coluna Tipo volta a aparecer e o campo de valor também. O botão só fica liberado se o fretista tiver PIX, valor digitado, borderô completo e rota completa.
- **Proteção:** se a leitura do cadastro com PIX falhar, a tela lê o cadastro de novo sem o PIX. Assim, a coluna Tipo não volta a sumir.

## Detalhes técnicos
- `RotasView.tsx`: o PIX vem do espelho local de responsáveis (já incluso em `ResponsavelErp`) e é passado ao `FreightInput` como `pix`. `podeConfirmar` passa a exigir `pix` quando `tipo === "F"` e a rota não está confirmada. Adicionar a mensagem abaixo do botão.
- `rota-pagamento.server.ts`: a prévia e `confirmarPagamentoRota` buscam o PIX em `erp_responsaveis` pelo código do responsável da rota. Sem PIX, a confirmação é recusada. A prévia retorna `pix` e `favorecido` para exibição. `montarTextoTarefa` (em torno da linha 240) recebe o PIX, o favorecido, o total e a data e acrescenta o bloco depois do resumo por filial.
- `PagamentoRotaDialog.tsx`: exibe o PIX e o favorecido.
- `roadmap.md`: registrar a tarefa.
- Verificação: tsgo, build e Playwright nas rotas 419 e 421.

## Histórico do PIX usado na autorização (novo pedido)
- Cada autorização (frete e adicional) grava o PIX usado e o favorecido. O favorecido não é conferido.
- Se o PIX atual do fretista for diferente do usado na última autorização dele, o botão "Confirmar Pgto" fica desabilitado. A mensagem abaixo do botão mostra o PIX anterior e o novo: "PIX alterado — aguardando liberação de um administrador".
- O administrador vê um botão "Liberar novo PIX" nessa mesma área. A liberação fica registrada (quem, quando, PIX anterior e novo). A partir dela, o novo PIX passa a ser a referência.
- O servidor também recusa a confirmação com PIX alterado e ainda não liberado.

### Técnico
- Nova migração `db/central/2026-09-24_pix_controle.sql`:
  - colunas `pix_utilizado` e `favorecido_pix` em `ordens_pagamento_frete`;
  - nova tabela `pix_liberacoes` (cod_erp, pix_anterior, pix_novo, liberado_por, liberado_em), com GRANTs;
  - você roda o script no banco, como os anteriores.
- Função `verificarPixRota` (servidor): compara com a última ordem da rota daquele responsável e com a última liberação. Fica exposta à tela e é usada em `confirmarPagamentoRota`.
- Nova função `liberarNovoPix`, só para administradores.
