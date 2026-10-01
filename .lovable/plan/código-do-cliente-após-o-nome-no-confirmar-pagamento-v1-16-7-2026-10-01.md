# Código do cliente após o nome no "Confirmar pagamento" — v1.16.7 (PATCH)

## O que muda

No modal **Confirmar pagamento** (lápis do frete), na tabela por filial de faturamento, a coluna **Cliente** passa a exibir o código do cliente do ERP entre parênteses após o nome:

`SUPERMERCADO DA FAMILIA S.A. (197084)`

Quando o pedido não tem código de cliente no ERP (ou o espelho ainda não o tem), mantém-se só o nome, sem parênteses.

Escopo: apenas a tela do modal. O texto da tarefa do Bitrix continua como está (mostra o nome; não recebe o código entre parênteses).

## Detalhes técnicos

- `src/lib/rota-pagamento.types.ts`: adicionar campo `cod_cliente: string | null` ao tipo `PedidoPagamento`.
- `src/lib/rota-pagamento.server.ts`: em `agrupar()`, preencher `cod_cliente` no item `PedidoPagamento` (já está disponível em `p.cod_cliente`; sem nova consulta).
- `src/components/routes/PagamentoRotaDialog.tsx`: célula da coluna Cliente (`ped.cliente`, ~linha 670) renderiza `ped.cliente` + ` (código)` quando `ped.cod_cliente` existir.
- `src/config/version.ts`: 1.16.6 → 1.16.7.
- `CHANGELOG.md`: nova entrada no topo.

Sem migração, sem flags, sem risco para a versão publicada.
