# Bloquear alteração do valor do frete após o pagamento confirmado

## O que muda

Hoje, quando o pagamento de uma rota já foi confirmado, o campo do valor do frete continua digitável para administradores — é o que aparece na sua tela: o selo "Pgto confirmado" ao lado de um campo ainda editável com 700.

A partir do ajuste:

- Assim que o pagamento é confirmado, o valor do frete deixa de ser editável para todos, inclusive administradores. Ele passa a ser exibido apenas como texto, com o selo "Pgto confirmado" abaixo.
- O caminho para mexer em valores continua existindo, mas apenas pelo botão "Reabrir / Lançar adicional" (somente administradores), que abre a tela de detalhamento e registra o lançamento adicional com histórico — em vez de sobrescrever o valor em silêncio.
- Nada muda para rotas ainda pendentes: o valor planejado continua digitável e gravado ao sair do campo.

Isso vale nas duas telas que usam o mesmo campo: "Rotas Pendentes" e "Autorizar pagamento de frete".

## Detalhes técnicos

Arquivo: `src/components/routes/RotasView.tsx`, componente do campo de frete (`FreightInput`, linhas ~315-455).

- `editable` passa de `tipo === "F" && (!confirmado || isAdmin)` para `tipo === "F" && !confirmado`. Com isso o ramo somente-leitura (linhas 360-368) já cobre a rota confirmada.
- No ramo somente-leitura, incluir o selo "Pgto confirmado" quando `confirmado` for verdadeiro, para o usuário entender por que o campo não é mais editável, e um `title` explicando "Pagamento confirmado — valor bloqueado; use Reabrir / Lançar adicional".
- `salvarPlanejado` ganha uma guarda `if (confirmado) return;`, evitando gravação residual caso o campo já esteja montado.
- O botão "Confirmar Pgto" / "Reabrir / Lançar adicional" e a regra `podeConfirmar` ficam como estão (reabertura segue restrita a administradores).
