# Refazer as praças da tabela TABELA-FRACIONADA conforme a planilha Pasta2.xlsx

Classificação: PATCH (v1.30.3) — só dados, sem mudança de tela.

## O que muda para o usuário
- A lista de cidades de cada praça da tabela TABELA-FRACIONADA passa a ser exatamente a da planilha (8 praças, ~190 cidades).
- Provisionamento de rotas e auditoria de CT-e reconhecem essas cidades automaticamente (ex.: Toritama e Garanhuns).

## Praças da planilha (cabeçalhos = nome da praça)
- REGIÃO METROPOLITANA (8)
- MATA SUL / NORTE (49)
- CARUARU POLO (1)
- CARUARU INTERIOR (70)
- SERRA / SALGUEIRO POLO (2)
- SERRA / SALGUEIRO INTERIOR (48)
- PETROLINA POLO / JUAZEIRO DA BAHIA (2)
- PETROLINA INTERIOR (5)

## Como será feito
1. Listar as praças já cadastradas na tabela e casar cada coluna pelo nome (ignorando acento/espaço). Se alguma praça da planilha não existir na tabela, paro e pergunto antes de criar.
2. "Refazer": substituir a lista de cidades de cada praça pela da planilha, apagando as cidades gravadas antes por escolha manual (o restante da observação da praça é mantido). Cidades fora da planilha deixam de ser reconhecidas.
3. Normalizar nomes ("JABOATÃO - POLO" vira JABOATAO e JABOATAO DOS GUARARAPES; abreviações como "S. MARIA DA BOA VISTA" também gravadas por extenso).
4. Cidades repetidas em duas praças serão listadas para você decidir.
5. Recalcular a rota 461 no preview para confirmar.

## Riscos
- Banco compartilhado: vale imediatamente também na versão publicada. Sem mudança de estrutura.
- Escolhas manuais feitas antes que não estejam na planilha serão perdidas.

## Detalhes técnicos
- Atualizar `tabelas_preco_frete_rotas.observacao` (linha `MUNICIPIOS: ...`) no banco central para as rotas da tabela com `codigo_interno = 'TABELA-FRACIONADA'`.
- Backup do valor atual de `observacao` de cada praça e script de restauração entregue para download.
- Atualizar `version.ts` e `CHANGELOG.md`.

## Checklist para publicar
- Rota 461: Toritama/Garanhuns em CARUARU INTERIOR, valor calculado e botão de gravar liberado.
- Sem migrações nem flags.
- Reverter: rodar o script de restauração.
