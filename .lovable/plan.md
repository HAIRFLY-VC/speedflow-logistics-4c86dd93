# Completar o cadastro de clientes (razão social, cidade e bairro)

## O que está acontecendo

O app guarda uma cópia local dos dados de clientes vinda do ERP. Hoje essa cópia tem apenas **117 clientes**, porque ela só é preenchida com os clientes que aparecem na consulta de pedidos pendentes de cada sincronização (~140 pedidos por vez).

Nos pedidos gravados no app existem **584 clientes diferentes** — **472 não têm cadastro na cópia local**. Entre os pedidos sem rota, **todos os 14 clientes estão faltando** (o cliente 182923 da imagem é um deles). Por isso a tela mostra "Cliente 182923" e nenhuma cidade/bairro/estado.

## Solução

Buscar o cadastro de clientes direto na tabela de clientes do ERP e manter a cópia local completa.

1. Nova consulta ao ERP no cadastro de clientes, trazendo código, razão social, nome de nota, bairro, cidade, estado (e CEP/endereço, se disponível).
2. Rodar essa carga durante a sincronização, mas só quando a cópia estiver desatualizada (uma vez por hora, mesmo critério já usado para os responsáveis), para não estourar o tempo da sincronização.
3. Complementar por demanda: a cada sincronização, identificar os códigos de cliente presentes em pedidos e ausentes na cópia e buscar apenas esses no ERP, em blocos.
4. Manter o comportamento atual como último recurso: se o cliente ainda não tiver cadastro, continua aparecendo só o código.

Depois de aplicado, a primeira sincronização preenche os 472 clientes faltantes e a tela "Pedidos sem rota" passa a mostrar razão social, estado, cidade e bairro em todos os itens.

## Informação necessária

Preciso do nome da tabela/visão de clientes no ERP (por exemplo `GKS.A_CADCLIENTE`) e do nome do campo do código do cliente. Se preferir, tento descobrir consultando o dicionário de dados do ERP antes de implementar — se a consulta de descoberta não for permitida pela API, volto a pedir o nome.

## Detalhes técnicos

- `src/lib/erp-sync.server.ts`: nova constante `CLIENTES_SQL` + função `sincronizarCadastroClientes()` com controle de idade (`maxAgeMs = 1h`), seguindo o padrão de `sincronizarEspelhoResponsaveis`; `sincronizarEspelhoClientes(rows)` continua como atualização incremental a partir dos pedidos.
- Upsert em blocos (~500) em `speedflow.clientes_erp` com `onConflict: "cod_cliente"`.
- Busca por códigos faltantes: `select cod_cliente` em `orders` + diferença com `clientes_erp`, consulta ao ERP com lista `IN` em blocos de ~200 códigos.
- Nenhuma mudança de schema é necessária; `useClientesErp` e a tela `pedidos-sem-rota.tsx` permanecem como estão.
