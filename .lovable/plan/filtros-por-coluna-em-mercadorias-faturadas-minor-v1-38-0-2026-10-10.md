# Filtros por coluna em "Mercadorias faturadas" (MINOR v1.38.0)

## O que muda
Cada cabeçalho da tabela ganha um ícone de filtro no estilo Excel (o mesmo já usado em "Entregas em aberto"), com opções conforme o tipo da coluna:

- **Texto/códigos** (ID rota, pedido, cliente, vendedor, filial, agenda, status, borderô, NF, placa, origem do frete, ocorrências etc.): lista de valores com contagem, pesquisa, "Selecionar tudo" e condição (contém, não contém, começa com, igual a).
- **Valores e peso** (VALOR, PESO, VLR_FRETE, VLR_PERNA, VLR_DIARIA, VLR_PERNOITE, VLR_REENTREGA, VLR_DESCARREGO): igual, diferente, maior, menor, maior/menor ou igual, entre.
- **Datas** (DT_PEDIDO, DT_FATUR, DT_SAIDA, DT_ETRG_TRSP, DT_ENTREGA_CLI, DT_AGENDAMENTO): igual, antes de, depois de, entre, vazio.

Também:
- Ordenação crescente/decrescente dentro do próprio filtro (clique no cabeçalho continua funcionando).
- Os valores listados em cada filtro consideram os demais filtros ativos (como no Excel).
- Botão "Limpar filtros (n)" ao lado da busca quando houver filtros ativos.
- Cards (Notas, Valor, Peso, Vlr. Frete, % frete), totais do rodapé e exportação Excel passam a refletir a listagem filtrada.
- Filtros ficam gravados por usuário para essa tela.

## Riscos
Nenhum impacto no banco ou integrações; apenas tela. Sem feature flag (política: oficial = teste).

## Detalhes técnicos
- `src/routes/_authenticated/custo-frete-mercadorias.tsx`: mapear `tipo` da coluna (`data`→date, `num`/`kg`→number, demais→text); usar `ColumnFilter`, `combinaFiltro`, `contarFiltros` e `useColumnFilterPrefs("custo-frete-mercadorias", ...)`; valor bruto: texto formatado para text, número para number, ISO para date; opções calculadas excluindo o filtro da própria coluna.
- Versão 1.38.0 + CHANGELOG.

## Checklist para publicar
- Testar no preview: filtrar texto, número "entre" e data; conferir totais e Excel.
- Migrações: nenhuma. Flags: nenhuma.
- Reverter: voltar à v1.37.x no histórico.
