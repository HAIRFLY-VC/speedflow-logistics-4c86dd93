# Atualizar cadastro do fretista no "Sync ERP"

## Causa
O botão "Sync ERP" só atualiza o cadastro de fretistas/transportadoras se a última atualização tiver mais de 1 hora. Por isso a correção do tipo de frete no ERP (rota 429: de "frete próprio" para fretista) não chegou ao app. Além disso, a lista de responsáveis usada nas telas considera o cadastro local válido por 24 horas.

## O que muda
1. Quando o usuário clicar em "Sync ERP" (execução manual), o cadastro de fretistas/transportadoras é sempre consultado de novo no ERP (tipo de frete, nome e PIX), sem esperar 1 hora. A sincronização automática continua com o intervalo atual, para não sobrecarregar o ERP.
2. Ao terminar o sync, as telas de rotas recarregam os dados de responsáveis, e a rota 429 passa a mostrar o fretista com a classificação correta.
3. Se o ERP falhar nessa parte, o restante do sync continua e o erro fica registrado no histórico.

## Detalhes técnicos
- `src/lib/erp-sync.server.ts`: em `syncErpOrders`, chamar `sincronizarEspelhoResponsaveis({ maxAgeMs: 0 })` quando `trigger === "manual"`; manter 1h nos demais. Aumentar o timeout dessa consulta de 25s para 60s.
- `src/components/layout/ErpSyncButton.tsx`: ao concluir, invalidar também as queries de responsáveis (`listarResponsaveisErp`) e de situação do PIX/pagamento.
- Validar consultando `erp_responsaveis` do fretista da rota 429 após um sync manual.
