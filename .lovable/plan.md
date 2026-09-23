# Reenviar os valores de frete da rota 414

A gravação no ERP foi corrigida do lado da API. Agora falta reenviar os dois lançamentos da rota 414 e confirmar que o valor realmente ficou gravado.

| Pedido  | Nota  | Filial | Borderô | Valor     |
| ------- | ----- | ----- | ------- | --------- |
| 4135181 | 65246 | 4065  | 32331   | R$ 633,28 |
| 4135182 | 65247 | 4065  | 32331   | R$ 66,72  |

## O que farei

1. Conferir se o ERP está respondendo.
2. Reenviar os dois lançamentos da rota 414 (mesma ação do botão "Reenviar" na tela "Autorizar pagamento de frete").
3. Acompanhar até o retorno e, principalmente, conferir direto no ERP se o valor do frete passou a constar nas duas notas — não basta o retorno "concluído".
4. Se o valor gravar, atualizar a situação da rota e avisar. Se voltar erro ou continuar sem gravar, mostrar a mensagem exata devolvida pelo ERP e o que ainda falta.

## Pendência separada (não entra neste passo)

A tarefa no Bitrix continua sem ser criada porque o fluxo "Frete Financeiro" só trata CT-e. Ele precisa de um desvio: quando a origem for rota de fretista, criar a tarefa direto com título, texto, data de pagamento e responsável que o aplicativo já envia.

## Detalhes técnicos

- Teste do ERP: `POST {ERP_API_BASE_URL}/v1/query` com consulta mínima.
- Reenvio: remover e reinserir as linhas de `fila_lancamento_erp_frete` da rota com `status: PENDENTE`, `ultimo_erro`/`processado_em` nulos, preservando `tentativas` (dispara `notify_fila_erp` para o webhook `speedflow/frete-valores`).
- Verificação final: `SELECT NRO_NF, VLR_FRETE FROM GKS.A_GERENTREGAS` para as notas 65246 e 65247 (borderô 32331, filial 4065), além de `status`/`referencia_erp` na fila.
