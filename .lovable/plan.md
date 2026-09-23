# Destravar a gravação do valor de frete no ERP (rota 414)

O passo do fluxo chama o endereço `.../v1/execute/update_vlr_gerentregas` e responde "sucesso", mas nenhuma linha é atualizada no ERP. Isso indica que a chave usada para localizar a nota não bate com o que enviamos (provavelmente procura pela chave da nota fiscal, que vai vazia).

## Como ver o corpo enviado (opcional, ajuda a confirmar rápido)

Na mesma tela do passo "Lançar Valores no ERP", role a área central para baixo, abaixo de "Body Content Type: JSON". Ali aparece a lista de campos (nome e valor) que o passo envia. Um print dessa parte já resolve a dúvida. O resultado da execução aparece no lado direito ("OUTPUT") depois de clicar em "Execute step".

Se não conseguir, seguimos sem isso pelo caminho abaixo.

## O que farei

1. Descobrir o formato aceito: chamar o endereço de gravação diretamente, em ambiente controlado, usando os dados reais da rota 414 (notas 65246 e 65247, filial 4065, borderô 32331), testando as combinações de chave possíveis até uma delas efetivamente alterar o valor.
2. Conferir no ERP se o valor do frete ficou gravado nas duas notas da rota 414.
3. Ajustar o que o aplicativo envia para o fluxo, passando exatamente os campos que o ERP exige, de modo que toda rota futura grave corretamente.
4. Reenviar a rota 414 pelo próprio aplicativo e confirmar que as duas linhas ficam concluídas e com valor no ERP.

## Tarefa no Bitrix (pendente separada)

A tarefa financeira continua sem ser criada porque o fluxo "Frete Financeiro" só trata CT-e. O aplicativo já envia tudo o que é necessário (título, texto, data de pagamento, responsável). Falta acrescentar no fluxo um desvio: quando a origem for rota de fretista, criar a tarefa direto com esses dados, sem procurar CT-e. Posso escrever o passo a passo exato para quem mantém o fluxo, se quiser.

## Detalhes técnicos

- Sondagem via `POST {ERP_API_BASE_URL}/v1/execute/update_vlr_gerentregas` com `X-API-Key`, variando os binds (`chave_nfe`, `nro_nf` + `cod_filial` + `bordero`, `cod_pedido`), e verificação por `POST /v1/query` em `GKS.A_GERENTREGAS`.
- Ajuste do payload em `src/lib/rota-pagamento.server.ts` (linhas da `fila_lancamento_erp_frete`) conforme o bind aceito.
- Reenvio pela tela "Autorizar pagamento de frete" → painel "Envios desta rota".
