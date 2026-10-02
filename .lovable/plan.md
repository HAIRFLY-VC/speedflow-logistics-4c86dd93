# UF, cidade e bairro dos clientes no modal Confirmar pagamento

## Objetivo
Na tabela por filial do modal "Confirmar Pgto" (tela Autorizar pagamento de frete):
1. Exibir para cada pedido a UF, a cidade e o bairro do cliente, além do nome/código já exibidos.
2. Exibir o total de mercadorias no totalizador de cada filial (hoje o cabeçalho da filial mostra apenas peso e frete; o valor de mercadoria já é calculado, falta exibi-lo).

## Classificação
PATCH (v1.16.11) — só exibição, sem mudança de comportamento, sem migração, sem feature flag.

## Origem dos dados
O espelho `clientes_erp` (banco central) já possui as colunas `uf`, `cidade` e `bairro` — é a mesma fonte usada pelas telas "Pedidos sem rota" e detalhe da rota. Hoje o pagamento consulta apenas `cod_cliente, razao_social, nome_nf`.

## Alterações
1. `src/lib/rota-pagamento.server.ts`
   - Ampliar a consulta a `clientes_erp` para trazer também `uf`, `cidade` e `bairro` (função `nomesDeClientes` passa a devolver dados completos do cliente).
   - Preencher os novos campos em cada item de pedido ao montar o agrupamento por filial.
2. `src/lib/rota-pagamento.types.ts`
   - Adicionar `uf`, `cidade` e `bairro` (string | null) ao tipo `PedidoPagamento`.
3. `src/components/routes/PagamentoRotaDialog.tsx`
   - Na coluna Cliente, exibir abaixo do nome uma linha menor em texto secundário: `UF · Cidade · Bairro` (omite partes vazias; mostra "—" quando não houver nenhuma).
4. `src/config/version.ts` → 1.16.11 e entrada no `CHANGELOG.md`.

## Riscos
- Nenhum risco ao banco ou integrações: apenas um `select` ampliado em tabela de leitura já utilizada.
- Clientes sem endereço no espelho exibem "—" (mesmo comportamento das demais telas).

## Checklist para publicar
- Abrir o lápis de uma rota em "Autorizar pagamento de frete" e conferir UF/cidade/bairro sob o nome de cada cliente.
- Sem migrações; sem flags; reversão pelo histórico de versões do Lovable.
