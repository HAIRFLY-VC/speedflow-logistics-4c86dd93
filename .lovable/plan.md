# Detalhamento de "Mercadorias faturadas" (MINOR v1.33.0)

## O que muda para o usuário
- No painel Custo de Frete, o card "Mercadorias faturadas" fica clicável e abre a nova tela "Mercadorias faturadas — detalhamento", já no ciclo comercial selecionado.
- A tela lista uma linha por nota fiscal faturada no ciclo, com as mesmas colunas e a mesma ordem da planilha de exemplo:
  ID Rota, Cód. Pedido, Cód. Cliente, Cód. Vendedor, Cód. Filial, Cód. Agenda, Dt. Pedido, Status, Dt. Faturamento, Entrega agendada, Borderô, Dt. Saída, Dt. Entrega transp., Dt. Entrega cliente, Dt. Agendamento, Cód. Transp. principal, Tipo transp. principal, Placa, Cód. Transp. entrega, Tipo transp. entrega, Nº NF, Valor, Peso, Vlr. Frete, Vlr. Perna, Vlr. Diária, Vlr. Pernoite, Vlr. Reentrega, Vlr. Descarrego, Tipos de ocorrência.
- Recursos da tabela padrão do app: filtro por coluna, ordenação, escolha/ocultação de colunas, totais de Valor, Peso e fretes no rodapé, e exportação para Excel com o mesmo layout da planilha.
- Seletor de ciclo comercial no topo e botão Voltar para o painel Custo de Frete.
- O total da coluna Valor bate com o número do card.

## Dados
- A maior parte das colunas já vem do ERP na sincronização atual (pedido, cliente, vendedor, filial, agenda, datas, borderô, placa, transportador de entrega, NF, valor, peso, ocorrências). O ID da rota vem do vínculo pedido → rota do app.
- Colunas que hoje não são trazidas do ERP: Dt. Entrega transp., Cód./Tipo transp. principal e os valores de frete (Frete, Perna, Diária, Pernoite, Reentrega, Descarrego). Proposta: incluí-las na leitura do ERP no Sync, em colunas novas e opcionais. Enquanto o próximo Sync não rodar, aparecem vazias.
- A planilha filtra agendas 417 e 427; a tela segue o mesmo critério do card (todas as notas faturadas no ciclo) para que os totais coincidam.

## Riscos
- Banco compartilhado: apenas colunas novas e opcionais na tabela espelho das entregas — retrocompatível com a versão publicada. Nenhuma exclusão ou alteração de dados existentes.
- ERP: somente leitura (consulta já usada no Sync, com campos a mais).

## Detalhes técnicos
- Nova rota `src/routes/_authenticated/custo-frete.mercadorias.tsx` (`/custo-frete/mercadorias?ciclo=AAAA-MM`), com `head()` próprio, usando `DataTable` (`tableKey="custo-frete-mercadorias"`) e `exportarXlsx`.
- Card em `custo-frete.tsx` vira `<Link>` com `search={{ ciclo }}`; página principal lê `ciclo` do search também.
- `custo-frete.query.ts`: nova função de detalhe reaproveitando a paginação de `entregas_abertas` (mesmo filtro `dt_fatur`) + lotes pedido→rota; select ampliado.
- Migração no banco central (`db/central/2026-10-09_entregas_detalhe_frete.sql`): `ADD COLUMN IF NOT EXISTS` dt_etrg_trsp date, cod_transp_prn text, tipo_transp_pn text, vlr_frete/vlr_perna/vlr_diaria/vlr_pernoite/vlr_reentrega/vlr_descarrego numeric. Reversão: `DROP COLUMN` das mesmas colunas.
- `erp-sync.server.ts`: incluir os novos campos de `A_GERENTREGAS` no mapeamento; tipos em `central/types.ts`.
- `version.ts` 1.33.0 e CHANGELOG.

## Checklist para publicar
- Rodar o SQL no banco central e depois o Sync ERP.
- Clicar no card, conferir total de Valor = card, trocar ciclo, exportar Excel e comparar com o exemplo.
- Reverter: v1.32.1 no histórico + DROP das colunas novas.
