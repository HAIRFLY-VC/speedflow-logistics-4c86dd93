# Fazer o pedido 4136262 aparecer no detalhamento (PATCH v1.34.1)

## Causa (confirmada)
- A tabela nova de notas faturadas ainda **não existe** no banco central (o script de v1.34.0 não foi executado).
- O Sync ERP das 18:57 tentou gravar as notas e falhou com "Could not find the table 'speedflow.notas_faturadas'". Sem ela, o painel recai no espelho antigo, que só tem entregas em aberto. O 4136262 (status "E", faturado em 06/10) fica de fora.
- O calendário comercial está correto (out/26 = 02/10 a 02/11), então o filtro de ciclo não é o problema.

## Correção
1. Eu mesmo aplico o script no banco central (só cria a tabela nova `notas_faturadas`; nada existente é alterado). SQL exatamente o do arquivo já entregue, `2026-10-09_notas_faturadas.sql`.
2. Disparo o Sync das notas faturadas e confiro que o pedido 4136262 foi gravado (NF 65655, R$ 1.816,23).
3. Abro o detalhamento de out/26 no preview e confirmo que o pedido aparece e que os totais batem com a planilha.
4. Melhoria: se o Sync não conseguir gravar as notas faturadas, a tela de detalhamento passa a mostrar um aviso ("dados parciais: só entregas em aberto") em vez de exibir a lista incompleta sem explicação.

## Riscos
- Banco compartilhado: só uma tabela nova; a versão publicada não a usa. Reversão: `DROP TABLE speedflow.notas_faturadas`.
- ERP: somente leitura.

## Detalhes técnicos
- Aplicar o SQL via conexão do banco central (`EXTERNAL_DB_URL`) e `NOTIFY pgrst, 'reload schema'`.
- Rodar `sincronizarNotasFaturadas()` (via execução do Sync) e consultar `notas_faturadas?cod_pedido=eq.4136262`.
- `custo-frete.query.ts`: expor a fonte usada (`tabelaNotas()`); página mostra aviso quando a fonte for `entregas_abertas`.
- `version.ts` 1.34.1 e CHANGELOG.

## Checklist para publicar
- Conferir 4136262 no detalhamento de out/26 e total de Valor vs planilha.
- Reverter: v1.34.0 no histórico (+ DROP da tabela, se desejado).
