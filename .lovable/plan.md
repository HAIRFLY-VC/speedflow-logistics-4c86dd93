# Gravar as praças da tabela TABELA-FRACIONADA (Solution Log - PE)

Classificação: PATCH (v1.30.3) — só gravação de dados, sem mudança de tela.

## O que muda para o usuário
- Todas as cidades da planilha passam a ser reconhecidas automaticamente no provisionamento de rotas e na auditoria de CT-e da tabela TABELA-FRACIONADA.
- Deixa de aparecer "praça não encontrada" para essas cidades (ex.: Toritama, Garanhuns).

## Como será feito
1. Conferir as praças já cadastradas na tabela (código interno TABELA-FRACIONADA) e casar cada coluna da imagem com uma praça existente:
   - Região Metropolitana (8 cidades)
   - Zona da Mata Norte e Sul / Interior 1 (~51)
   - Caruaru / Agreste - Interior 1 (~76)
   - Serra Talhada Polo / Sertão - Interior 2 (~39)
   - Salgueiro Polo / Sertão - Interior 2 (~20)
   - Petrolina Polo / Sertão - Interior 2 (5)
   Se alguma coluna não tiver praça correspondente, paro e pergunto antes de criar.
2. Gravar as cidades em cada praça usando o mesmo campo de "cidades aprendidas" que a escolha manual de praça já usa (mantendo as escolhas feitas antes).
3. Cidades que estiverem em mais de uma praça (ex.: "Cortes" aparece só na Mata, sem conflito previsto) serão listadas para você decidir.
4. Recalcular a rota 461 no preview para confirmar.

## Riscos
- Altera dados do banco compartilhado (teste e oficial ao mesmo tempo): a tabela passa a reconhecer as cidades imediatamente também na versão publicada. Sem mudança de estrutura.
- Nomes abreviados (ex.: "S. J. DA COROA GRANDE", "S. CRUZ DO CAPIBARIBE") serão gravados também na forma por extenso, para casar com o nome que vem do ERP/CT-e.

## Detalhes técnicos
- Atualizar `tabelas_preco_frete_rotas.observacao` (linha `MUNICIPIOS: A; B; ...`) via mesmo formato de `comMunicipioAprendido`, no banco central.
- Reversão: guardo antes o valor atual de `observacao` de cada praça e entrego script para restaurar.

## Checklist para publicar
- Abrir provisionamento da rota 461 e conferir Toritama/Garanhuns em CARUARU.
- Sem migrações nem flags.
- Reverter: rodar o script de restauração da observação.
