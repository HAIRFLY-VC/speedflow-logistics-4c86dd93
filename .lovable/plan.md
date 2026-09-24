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
