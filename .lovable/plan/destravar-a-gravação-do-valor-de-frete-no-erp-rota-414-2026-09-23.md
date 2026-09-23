# Destravar a gravação do valor de frete no ERP (rota 414)

O fluxo chama `.../v1/execute/update_vlr_gerentregas` com estes campos: `vlr_frete`, `vlr_perna`, `vlr_diaria`, `vlr_pernoite`, `vlr_reentrega`, `vlr_descarrego`, `bordero`, `cod_filial`, `nro_nf`.

Os nomes batem exatamente com o que o aplicativo envia — ou seja, não falta campo. O que muda é o **formato**: o aplicativo manda nota, filial e borderô como texto (`"65246"`, `"4065"`, `"32331"`), enquanto no ERP essas colunas são numéricas. A busca não encontra a linha, nenhuma é alterada, e a resposta ainda assim volta como sucesso — exatamente o comportamento observado.

## O que farei

1. Confirmar a causa: chamar o endereço de gravação com os dados reais da rota 414 (notas 65246 e 65247, filial 4065, borderô 32331), primeiro como número, e conferir direto no ERP se o valor do frete passou a constar.
2. Ajustar o aplicativo para enviar nota, filial e borderô como número no envio ao fluxo (mantendo o registro em texto no histórico interno).
3. Reenviar a rota 414 pela tela "Autorizar pagamento de frete" e confirmar as duas linhas concluídas com valor gravado no ERP.
4. Se o teste mostrar que a causa é outra (por exemplo, a busca também exige a chave da nota), reporto o achado e o ajuste correspondente antes de mexer no código.

## Tarefa no Bitrix (pendente separada)

Continua sem ser criada porque o fluxo "Frete Financeiro" só trata CT-e. O aplicativo já envia título, texto, data de pagamento e responsável. Falta no fluxo um desvio: quando a origem for rota de fretista, criar a tarefa direto com esses dados, sem procurar CT-e. Posso escrever o passo a passo para quem mantém o fluxo.

## Detalhes técnicos

- Sondagem: `POST {ERP_API_BASE_URL}/v1/execute/update_vlr_gerentregas` com `X-API-Key` e binds numéricos; verificação por `POST /v1/query` em `GKS.A_GERENTREGAS` (VLR_FRETE por NRO_NF/BORDERO).
- Ajuste em `src/lib/rota-pagamento.server.ts`: conversão numérica de `nro_nf`, `cod_filial` e `bordero` no `payload` das linhas de `fila_lancamento_erp_frete` (colunas do histórico permanecem texto).
- Reenvio pelo painel "Envios desta rota" no diálogo de pagamento.
