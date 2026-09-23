# Forçar o envio dos valores de frete da rota 414

## Situação atual

Os dois lançamentos da rota 414 (M- ARCOMIX) já estão com os dados corretos:

| Pedido  | Nota  | Filial | Borderô | Valor      | Situação |
|---------|-------|--------|---------|------------|----------|
| 4135181 | 65246 | 4065   | 32331   | R$ 633,28  | Erro 502 |
| 4135182 | 65247 | 4065   | 32331   | R$ 66,72   | Erro 502 |

O erro antigo ("falta nro_nf") já não acontece. As duas últimas tentativas falharam
porque o servidor do ERP respondeu "502 — servidor indisponível". Nas verificações
mais recentes ele continuava fora do ar.

## O que fazer

1. Testar se o ERP voltou a responder.
2. Se estiver no ar, reenviar os dois lançamentos da rota 414 para a fila de valores
   (mesma ação do botão "Reenviar" da tela de autorização) e acompanhar até o retorno.
3. Conferir o resultado: cada linha deve ficar como "Concluído" com a referência
   devolvida pelo ERP; se voltar erro, mostrar a mensagem exata que o ERP devolveu.
4. Se o ERP ainda estiver fora do ar, tentar algumas vezes com intervalo. Não dá para
   forçar a gravação com o ERP indisponível — nesse caso o retorno é: fica pronto para
   reenviar pelo botão da tela assim que o ERP normalizar.

A tarefa do Bitrix não entra neste passo: ela depende do ajuste no fluxo
"Frete Financeiro" do n8n para tratar rotas de fretista.

## Detalhes técnicos

- Reenvio = remover e reinserir a linha em `fila_lancamento_erp_frete` com
  `status: PENDENTE`, `ultimo_erro`/`processado_em` nulos, preservando `tentativas`
  (mesmo comportamento de `reenviarItemFila`), o que dispara o gatilho `notify_fila_erp`
  para o webhook `speedflow/frete-valores`.
- Teste de disponibilidade do ERP: `POST {ERP_API_BASE_URL}/v1/query` com uma consulta
  mínima; hoje retorna HTML 502 da Cloudflare.
- Verificação final lendo `fila_lancamento_erp_frete` por `route_id`
  (`status`, `tentativas`, `referencia_erp`, `ultimo_erro`) e, em caso de sucesso,
  atualização de `ordens_pagamento_frete` para a rota.
