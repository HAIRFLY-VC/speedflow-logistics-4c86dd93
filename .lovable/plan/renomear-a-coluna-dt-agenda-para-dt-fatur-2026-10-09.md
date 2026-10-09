# Renomear a coluna "Dt. agenda" para "Dt. fatur."

## O que muda

O cabeçalho da coluna passa a se chamar **Dt. fatur.** em três lugares, sem alterar nada nos valores exibidos:

| Tela | Onde aparece |
|---|---|
| Detalhe da rota (a tela da sua imagem) | Lista de pedidos agrupados por cliente |
| Pedidos sem rota | Cabeçalho da lista e rótulo na visão de celular |
| PDF de impressão da rota | Coluna da tabela de entregas |

Os dados mostrados continuam sendo os mesmos de hoje (a data de agenda do pedido no ERP). Pedidos sem essa data seguem exibindo "—".

## Classificação

**PATCH — v1.37.1.** É só texto de cabeçalho: nenhum fluxo, cálculo, consulta ou banco é tocado.

## Riscos para a versão publicada

Praticamente nulos. Não há migração, não há mudança de consulta ao ERP, não há mudança de permissão. O único efeito visível é o novo nome da coluna.

## Implementação

- `src/routes/_authenticated/rotas.$routeId.tsx` — cabeçalho da tabela de pedidos agrupados.
- `src/routes/_authenticated/pedidos-sem-rota.tsx` — cabeçalho da lista e o rótulo usado na versão de celular.
- `src/components/print/RotaPrintDocument.tsx` — cabeçalho da tabela impressa.
- `src/config/version.ts` — versão para `1.37.1`.
- `CHANGELOG.md` — entrada nova no topo, em português.

Nada mais é alterado: nomes de campos internos, consultas ao ERP e o PDF continuam funcionando exatamente como hoje.

## Checklist para publicar

- **O que testar no preview:** abrir o detalhe de uma rota (ex.: a rota da sua imagem) e conferir que a coluna entre "Dt. pedido" e "Valor" agora diz "Dt. fatur."; abrir Pedidos sem rota e conferir o mesmo; gerar o PDF de impressão de uma rota e conferir a coluna na prévia.
- **Banco de dados:** nada foi alterado, nenhuma migração foi aplicada.
- **Chaves para ligar:** nenhuma.
- **Como reverter:** voltar para a versão 1.37.0 no histórico do Lovable. Não há reversão de banco porque não houve mudança de banco.

## Detalhes técnicos

- Troca de 4 strings de rótulo: `rotas.$routeId.tsx:852`, `pedidos-sem-rota.tsx:895` (cabeçalho) e `:924` (rótulo mobile), `RotaPrintDocument.tsx:244`.
- O campo-fonte permanece `dtAgenda` (ERP `DT_AGENDA`) em `src/lib/rota-erp.functions.ts`; o tipo `PedidoDetalheRota` e as consultas não mudam.
- Sem feature flag: é mudança de rótulo, não funcionalidade nova.
- Verificação: typecheck + leitura dos três arquivos; checagem visual no preview do detalhe da rota e da prévia de impressão.
