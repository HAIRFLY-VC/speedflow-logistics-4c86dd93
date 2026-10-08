# Transportadoras: importar também pelo Sync ERP

## Diagnóstico
- O cadastro continua com só 1 transportadora porque a importação da v1.27.0 só roda pelo botão "Atualizar cadastro do ERP" desta tela, e ele não foi chamado. O que rodou foi o "Sync ERP" do topo, que não importa transportadoras.
- O ERP tem 28 transportadoras (natureza ET), todas com CNPJ preenchido, então todas podem ser importadas.

Classificação: PATCH (v1.27.1).

## O que muda
- O "Sync ERP" do topo passa a importar as transportadoras, igual ao botão "Atualizar cadastro do ERP". A tela Transportadoras é atualizada ao terminar.
- Depois da aprovação, rodo a importação uma vez para a lista já mostrar as 28, sem precisar clicar em nada.
- Continua sem sobrescrever nome, CNPJ, banco ou tabela de frete das que já existem.

## Riscos
- Insere cerca de 27 transportadoras reais do ERP no cadastro compartilhado (teste e oficial). A SOLUTION aparece com 5 CNPJs de filiais diferentes e vai virar 5 cadastros; os nomes vêm cortados em 30 letras, editáveis pelo lápis.

## Detalhes técnicos
- Extrair a lógica de `importarTransportadorasErp` para um helper server-only (`transportadoras-erp.server.ts`) usado pela server function e por `syncErpOrders` em `erp-sync.server.ts` (falha na importação não derruba o sync; vai para os erros do sync).
- `ErpSyncButton` invalida `["transportadoras"]` ao concluir.
- Execução única da importação via script com a chave do banco central.
- Atualizar `version.ts` e `CHANGELOG.md`.

## Checklist para publicar
- Abrir Transportadoras e conferir as 28; clicar em Sync ERP e confirmar que não duplica.
- Sem migração nem flags.
- Reverter: versão 1.27.0; transportadoras importadas podem ser desativadas na tela.
