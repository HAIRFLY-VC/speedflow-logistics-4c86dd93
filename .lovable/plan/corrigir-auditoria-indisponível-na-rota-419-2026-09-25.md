# Corrigir "Auditoria indisponível" na rota 419

## Causa
Na auditoria, o ERP devolve a mesma nota/pedido mais de uma vez para a rota 419 (ex.: uma linha por ocorrência ou agendamento). O app tenta gravar todas as linhas de uma só vez, e o banco recusa gravar a mesma nota duas vezes no mesmo envio. Por isso aparece o erro "ON CONFLICT DO UPDATE command cannot affect row a second time" e a auditoria não termina.

## Correção
- Antes de gravar, juntar as linhas repetidas da mesma nota + pedido em uma só, mantendo a mais completa (a última recebida) e unindo os tipos de ocorrência.
- Fazer a mesma proteção na gravação dos pedidos novos (chave do pedido no ERP), para o erro não voltar por outro caminho.
- Os valores e pesos não serão somados em dobro.

## Validação
- Clicar em "Conferir de novo" na rota 419 e confirmar que aparece "Rota completa" ou "Rota incompleta".
- Conferir que 414, 416 e 421 continuam normais.

## Detalhes técnicos
- `src/lib/rota-auditoria.server.ts` (~linha 164): deduplicar `entregas` por `nro_nf|cod_pedido` num Map antes do `upsert` (`onConflict: "nro_nf,cod_pedido"`); concatenar `tipos_ocorrencia` distintos.
- ~linha 233: deduplicar `novos` por `erp_id` antes do `upsert`.
