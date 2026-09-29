# Lista de pedidos abaixo do mapa (capa da rota) — v1.10.0 (MINOR)

## O que muda
A lista simples sob "Mapa e sequência da rota" vira uma tabela agrupada por cliente, na ordem de entrega.

**Linha do cliente (aparece uma única vez por cliente, mesclando os pedidos dele):**
- Razão social (código do cliente) · UF · Cidade · Bairro · número da parada

**Linhas de pedido (abaixo do cliente, uma por pedido):**
- Código do pedido (clicável para o histórico de status, como nas demais telas)
- Status do pedido
- Filial de faturamento
- Nota fiscal
- Vendedor (código)
- Agenda
- Data do pedido
- Data da agenda
- OBS · OBS LOGIST · INF_CMP (textos longos quebram linha dentro da célula)

**Ordem:** clientes na mesma sequência de entrega mostrada no mapa (parada 1, 2, 3...). Pedidos do mesmo cliente ficam juntos sob a parada dele.

O selo "endereço alternativo" continua aparecendo no cliente quando houver.

## Riscos
- Somente leitura no ERP; nenhuma gravação, migração ou mudança no banco compartilhado.
- Se o ERP não responder, a lista mostra os dados locais já disponíveis e "—" nos campos faltantes, sem travar a tela.

## Detalhes técnicos
- Nova server function em `src/lib/rota-erp.functions.ts` (`listarPedidosDetalheRota`): recebe os códigos dos pedidos da rota e consulta o ERP (mesma base de `PENDING_ORDERS_SQL`/nota fiscal em `erp-sync.server.ts`) retornando cod_cliente, razão social, UF, cidade, bairro, status, cod_filial, nro_nf, cod/nome vendedor, cod_agenda, data pedido, data agenda, OBS, OBS_LOGIST, INF_CMP. Consulta em lotes, timeout de 60s com fallback vazio.
- `RouteMapCard` em `src/routes/_authenticated/rotas.$routeId.tsx`: usa `useQuery` com essa função, junta pelos códigos, agrupa por cliente seguindo `sequenceStops` e renderiza tabela compacta (fonte pequena, sem rolagem lateral; OBS com quebra).
- Status reutiliza a abreviação/cores existentes (`StatusList`) quando aplicável.
- Atualizar `src/config/version.ts` e `CHANGELOG.md` para 1.10.0.

## Checklist para publicar
- Abrir uma rota com cliente que tenha 2+ pedidos e conferir que o cliente aparece uma vez só.
- Conferir ordem igual à do mapa.
- Sem migrações; sem flags pendentes. Reverter: versão 1.9.3 no histórico.
