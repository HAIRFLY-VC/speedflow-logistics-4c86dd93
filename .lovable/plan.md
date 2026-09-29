# Histórico de status do pedido (log do ERP)

Classificação: **MINOR (v1.4.0)** — nova funcionalidade, sem mudança de banco.

## O que o usuário verá

- Em todas as telas onde aparece o código do pedido, o código fica clicável (sublinhado ao passar o mouse, com um pequeno ícone de relógio).
- Ao clicar, abre uma janela sobreposta "Histórico de status — Pedido N" com uma tabela ordenada da mais antiga para a mais recente:
  - Data/hora de entrada
  - Status
  - Usuário
  - Observação
- Estados: "Consultando o ERP...", lista vazia ("Nenhum registro de status para este pedido") e erro amigável com botão "Tentar de novo".
- O clique no código não dispara a ação da linha (ex.: abrir detalhe, marcar checkbox).

## Telas cobertas

Pedidos (lista e detalhe), Pedidos sem rota, Separação, Kanban, Entregas abertas, Sugestão de rotas, detalhe da Rota, Minhas rotas, janela de pagamento da rota (pedidos por filial e quadro "Rota incompleta") e notificações que citam pedido.

## Riscos para a versão publicada

- Apenas leitura no ERP (SELECT); nenhuma gravação em banco ou ERP.
- Sem feature flag necessária por ser só leitura? Seguindo a política, fica atrás da flag `historicoStatusPedido` (ligada em teste, desligada em produção) até você pedir para liberar.

## Detalhes técnicos

- `src/lib/pedido-historico.functions.ts`: server fn `historicoStatusPedido` (auth obrigatória, papéis staff), valida `codPedido` numérico com zod, chama `POST {ERP_API_BASE_URL}/v1/query` com
  `select l.dta_entrada,l.status,l.usu_entrada,l.obs from gks.a_logstatusped l where l.id=:codpedido order by l.dta_entrada` e bind `codpedido`; timeout de 30s, trim dos campos (padding Oracle).
- `src/components/orders/PedidoHistoricoLink.tsx`: componente `<PedidoCodigo codigo=... />` que renderiza o código + abre `Dialog` com `useQuery` (carrega só ao abrir), `stopPropagation` no clique. Se a flag estiver desligada, renderiza só o texto.
- Substituir a exibição do código do pedido pelos componentes nas telas listadas (inclui colunas do `DataTable` via `cell`).
- `src/config/features.ts`: nova flag. `version.ts` → 1.4.0 e entrada no `CHANGELOG.md`.

## Validação

Playwright: abrir o histórico a partir de Pedidos e da janela de pagamento da rota 419 e conferir as colunas e a ordenação.
