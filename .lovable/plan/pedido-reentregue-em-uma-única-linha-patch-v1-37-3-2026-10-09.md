# Pedido reentregue em uma única linha (PATCH v1.37.3)

## Problema
Quando um pedido sai para entrega, retorna e é reexpedido, o ERP gera uma nova nota/borderô (ex.: pedido 4135271 aparece com borderô 32365 e 32400). Hoje cada nota vira uma linha, e o valor das mercadorias e o peso são contados duas vezes no % de frete.

## Regra nova (aplicada em todos os cálculos de % frete)
Para cada pedido com mais de uma nota no ciclo:
- Fica **uma única linha**.
- Todos os dados (NF, cliente, status, datas, valor, peso, transportador etc.) vêm da nota de **maior número de borderô**.
- Os campos **VLR_FRETE, VLR_PERNA, VLR_DIARIA, VLR_PERNOITE, VLR_REENTREGA e VLR_DESCARREGO são somados** de todas as notas do pedido (cada nota primeiro recebe seu frete real ou provisionado, depois soma).
- Origem do frete: "R" se alguma nota tiver frete real, senão "P".

## Onde vale
- Tela **Mercadorias faturadas** (tabela, totais, cards, Excel).
- Painel **Custo de Frete** (indicadores, evolução de 6 ciclos e todas as tabelas por dimensão).
- Card **% Frete do ciclo** em Rotas Pendentes.

Todos já usam a mesma rotina de carga, então a consolidação é feita nela uma única vez.

## Visual
- A linha consolidada fica com fundo em cor de destaque (âmbar suave, token do tema).
- Ícone de alerta ao lado do código do pedido; ao passar o mouse aparece: "Pedido reentregue: N entregas (borderôs 32365, 32400; NFs …). Dados do borderô 32400; valores de frete somados."
- No Excel, nova coluna "REENTREGA" com S/N e a lista de borderôs.

## Detalhes técnicos
- `src/lib/custo-frete.query.ts`: nova função `consolidarReentregas(linhas)` agrupando por `cod_pedido`, escolhendo a linha de maior `Number(bordero)` (empate: maior `dt_saida`/`nro_nf`), somando os 6 campos de frete e adicionando `reentrega: { qtd, borderos[], nfs[] } | null` em `LinhaMercadoria`.
- Mercadorias: `carregarMercadorias` → `aplicarProvisoes` → `consolidarReentregas` (provisão é por filial+NF, por isso vem antes).
- `carregarCustoFrete`: passa a montar as linhas a partir do resultado consolidado (valor/peso da linha escolhida, frete somado), eliminando a contagem dupla de valor/peso.
- `custo-frete-mercadorias.tsx`: classe de destaque + `Tooltip` do shadcn na linha com `reentrega`; chave da linha passa a ser `cod_pedido`.
- Sem alterações no banco, sem flags novas. CHANGELOG + versão 1.37.3.

## Checklist para publicar
- Conferir o pedido 4135271 em set/26: uma linha, borderô 32400, frete somado, tooltip visível.
- Comparar o % do card de Rotas Pendentes, do painel e da tela de mercadorias (devem coincidir).
- Reversão: voltar para v1.37.2 no histórico.
