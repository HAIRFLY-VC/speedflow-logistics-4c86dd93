# Exibir NF-es herdadas na listagem de CT-e

## Objetivo

Corrigir a coluna **NF-es** da primeira listagem para que CT-es complementares, como o **20213/2**, mostrem as mesmas notas fiscais já exibidas no detalhamento.

## Diagnóstico confirmado

- A primeira listagem lê somente `nfs_referenciadas` do próprio CT-e.
- O detalhamento identifica o CT-e original pela chave ou pelo número vinculado e, quando o complementar não possui notas próprias, usa as notas do original.
- No CT-e 20213/2, o detalhamento informa que as NF-es **65348** e **65349** pertencem ao CT-e original nº **19503**; por isso elas aparecem no detalhe, mas não na listagem atual.

## Implementação

1. Na carga da listagem, identificar os CT-es complementares sem notas próprias e localizar seus CT-es originais usando os mesmos vínculos já adotados no detalhamento.
2. Montar, somente para exibição, a lista efetiva de NF-es: notas próprias quando existirem; caso contrário, notas do CT-e original.
3. Fazer a coluna **NF-es** usar essa lista efetiva também no filtro, na ordenação, nos cartões estreitos e no seletor de colunas.
4. Manter números únicos e o formato compacto atual; CT-es realmente sem notas continuam mostrando `—`.
5. Validar o CT-e 20213/2 na listagem, confirmando **65348, 65349**, e conferir um CT-e normal para evitar regressão.

## Versão e risco

- Classificação: **PATCH**.
- Versão proposta: **1.40.1**, com registro no changelog.
- Sem migração, gravação no banco ou chamada adicional ao ERP.
- A correção altera apenas a leitura e apresentação dos dados já existentes; a versão publicada atual não é afetada até o Publish.

## Checklist para publicar

- Conferir na listagem que o CT-e 20213/2 mostra as NF-es 65348 e 65349.
- Conferir filtro e ordenação da coluna NF-es.
- Conferir CT-e normal com nota própria e CT-e sem qualquer nota.
- Migrações aplicadas: nenhuma.
- Flags após Publish: nenhuma alteração; a flag existente já está ativa em teste e produção.
- Reversão: restaurar a versão 1.40.0 no histórico do Lovable; não há SQL de reversão.
