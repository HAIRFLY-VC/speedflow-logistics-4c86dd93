# Valor/Peso antes de OBS e Borderô por pedido — v1.16.6 (PATCH)

## O que muda
Na tabela de pedidos abaixo do mapa (detalhe da rota):
- As colunas **Valor** e **Peso** passam a ficar logo após **Dt. agenda**, antes de **OBS**.
- Coluna nova **Borderô** logo após **NF**, com o número do borderô de cada pedido (se o pedido ainda não tem borderô no app, mostra "—").
- A linha de subtotal de cada entrega (cliente) continua com valor somado, peso somado e quantidade de pedidos; a posição dos totais acompanha a nova ordem (Valor/Peso antes das colunas de texto).

Ordem final: Pedido · Status · Filial · NF · Borderô · Vendedor · Agenda · Dt. pedido · Dt. agenda · Valor · Peso · OBS · OBS Logist · INF_CMP.

## De onde vem o borderô
Cada pedido já tem `bordero` gravado no app (atualizado pela auditoria da rota e pelo Sync ERP, que escolhe o borderô atual do ERP). A tabela passa a ler esse campo junto com os demais dados do pedido. Sem consulta nova ao ERP.

## Detalhes técnicos
- `src/routes/_authenticated/rotas.$routeId.tsx`:
  - Na consulta de paradas (`stopsQ`, select de `orders`), incluir `bordero`.
- Em `PedidosDaRotaTabela`: represar `bordero` em `ordered`, mover os `<th>`/células de Valor e Peso para antes de OBS, inserir o `<th>`/célula de Borderô logo após NF e ajustar os `colSpan` da linha de subtotal (9 células antes de Valor/Peso, 3 depois: OBS + OBS Logist + INF_CMP).
- Versão `1.16.6` em `src/config/version.ts` + entrada no `CHANGELOG.md`.
- Sem migração, sem flags, sem mudança de regras de negócio.

## Riscos e reversão
- Risco baixo: só apresentação. Nenhum dado é gravado.
- Reverter: versão anterior no histórico.

## Checklist para publicar
- Preview: abrir o detalhe de uma rota com pedidos faturados e conferir a nova ordem das colunas e o borderô de cada pedido; conferir subtotal por cliente.
- Migrações: nenhuma. Flags: nenhuma.
- Publicar para valer na versão oficial.
