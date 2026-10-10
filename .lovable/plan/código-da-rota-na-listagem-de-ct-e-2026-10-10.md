# Código da rota na listagem de CT-e

Classificação: **MINOR** — nova coluna informativa, sem mudança de fluxo. Versão proposta: **1.42.0**.

## O que muda

Na tela **CT-e**, nova coluna **Rota** logo após **NF-es**, mostrando o código da(s) rota(s) no ERP (ex.: `#419`) à(s) qual(is) o conhecimento está associado:

```text
CT-e   NF-es     Rota      Transportadora ...
20260/2  65688   425       SOLUTION ...
```

## Como o código da rota é resolvido

- O CT-e já lista as NF-es participantes (`nfs_exibicao`, com herança de CT-es complementares — reuso da lógica v1.40.1).
- Cada número de NF é procurado no espelho `speedflow.notas_faturadas` (nro_nf → cod_pedido), no mesmo cliente central já usado pela tela.
- Cada pedido é procurado em `orders` com `route_orders(routes(code, erp_route_id))`.
- A coluna exibe a lista de códigos distintos (`erp_route_id ?? code`), separados por vírgula; sem vínculo, `—`.
- Consultas em lotes de 100, mesmo padrão das buscas de CT-e originais já usadas na tela.

## Alterações

1. `src/routes/_authenticated/ctes.index.tsx`
   - No `queryFn` de `["ctes"]`: coletar números das NF-es das linhas, carregar `notas_faturadas` e `orders → route_orders → routes`, devolver `rotas_codigo` em cada `CteRow`.
   - Nova coluna `id: "rota"`, `header: "Rota"`, `pinAfter: "nfes"` (fallback `pinAfter: "numero"` quando a coluna NF-es estiver desligada), ordenável e filtrável por texto, com tooltip dos pedidos de origem.
2. `src/config/features.ts`: flag `rotaNaListaCte: { test: true, production: true }` (padrão do projeto: oficial igual ao teste).
3. `src/config/version.ts` → `1.42.0` e entrada no `CHANGELOG.md`.

## Riscos e impacto

- Nenhuma migração nem gravação no banco: só leitura do espelho já existente.
- CT-es com NF de ciclo antigo (fora do espelho) ou sem pedido/rota mostram `—`.
- Custo: 2 consultas extras em lotes por carregamento da listagem, do mesmo tamanho das já existentes.

## Validação

- Conferir o CT-e 20260/2 (NF 65688): a coluna deve mostrar o código da rota do pedido.
- Conferir CT-e sem notas e complementar herdando notas do original.
- Testar filtro/ordenação pela coluna e visualização estreita (cartões).
