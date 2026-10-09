# % do frete no canto superior direito do card "Vlr. Frete"

## O que muda

Na tela **Mercadorias faturadas** (`/custo-frete-mercadorias`), o card **Vlr. Frete** passa a mostrar o percentual do frete sobre o valor das mercadorias no canto superior direito, com a mesma fonte do valor do frete (negrito, mesmo tamanho).

Antes:

```text
+--------------------------+
| Vlr. Frete               |
| R$ 4.241,73              |
| Real R$ 3.792,22 / Prov  |
+--------------------------+
```

Depois:

```text
+--------------------------+
| Vlr. Frete        3,47%  |
| R$ 4.241,73              |
| Real R$ 3.792,22 / Prov  |
+--------------------------+
```

## Regra do percentual

- `% = frete / mercadorias × 100`, usando os totais da própria lista:
  - frete = soma de **VLR_FRETE** (real + provisionado, exatamente o valor já exibido no card);
  - mercadorias = soma de **VALOR**.
- Mesma fórmula do painel Custo de Frete e do card "% Frete do ciclo", então os números batem entre as telas.
- Formatação: 2 casas decimais em português (ex.: `3,47%`).
- Sem mercadorias somadas (valor zero) ou enquanto carrega: mostra `—` / `…` em vez de dividir por zero.
- O percentual segue a busca e os filtros ativos da tela, igual aos demais cards.
- Nenhum outro card muda, e nada muda no banco, no ERP ou nas consultas.

## Checklist para publicar

1. Abra `/custo-frete-mercadorias?ciclo=2026-10-01`: o card Vlr. Frete deve trazer o % no topo à direita, no mesmo estilo do valor.
2. Confira se o % bate com o card "% Frete do ciclo" / painel Custo de Frete do mesmo ciclo.
3. Busque um termo que retorne poucas linhas e confirme que o % muda junto com a lista.
4. Nenhuma migração, nenhuma chave a ligar. Reversão: voltar para a v1.36.0.

## Classificação

- **PATCH — v1.36.1**: alteração apenas de exibição, sem mudança de comportamento ou dados.
- Sem feature flag (tela já está no ar e a mudança é puramente visual); sem alteração no banco compartilhado.

## Detalhes técnicos

- Arquivo: `src/routes/_authenticated/custo-frete-mercadorias.tsx`.
- Na linha de título do card (hoje um `<p>` simples dentro de `CardContent`), trocar por um contêiner flex `justify-between`: à esquerda o rótulo do card e, à direita, o percentual — somente quando o card for "Vlr. Frete".
- Percentual com as mesmas classes do valor do frete (`text-lg font-bold tabular-nums`), `leading-none` para não aumentar a altura do card.
- Cálculo inline a partir dos totais já existentes: `tot("vlr_frete")` e `tot("valor")`; `null` quando `tot("valor")` for 0; `…` enquanto `q.isLoading`.
- Formatação com `toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })` + `%`, igual a `pctFmt` do painel Custo de Frete.
- Atualizar `src/config/version.ts` para `1.36.1` e incluir entrada no topo do `CHANGELOG.md` (Adicionado/Alterado, em português).
