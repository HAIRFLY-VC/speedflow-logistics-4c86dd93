# Coluna de notas fiscais na listagem de CT-e

## Objetivo

Adicionar à tela **CT-e** uma coluna **NF-es** para mostrar os números das notas fiscais que participam de cada conhecimento.

## Implementação

1. Inserir a coluna **NF-es** logo após **CT-e** na tabela principal.
2. Ler as chaves já disponíveis em `nfs_referenciadas` e extrair de cada chave de 44 dígitos o número da NF-e.
3. Remover números repetidos e exibi-los em formato compacto, separados por vírgula; quando não houver nota vinculada, mostrar `—`.
4. Permitir ordenar e filtrar a coluna pelo conteúdo, aproveitando os controles existentes da tabela.
5. Garantir que a coluna também apareça nos cartões da visualização estreita e possa ser ocultada no seletor **Colunas**.
6. Proteger a funcionalidade com flag ativa em teste e produção, conforme a regra do projeto.

## Versão e histórico

- Classificação: **MINOR**, por adicionar informação à listagem sem alterar fluxos existentes.
- Versão proposta: **1.40.0**.
- Registrar no changelog que a listagem de CT-e passa a mostrar as NF-es participantes.

## Riscos e impacto

- Nenhuma migração ou gravação no banco compartilhado.
- Nenhuma chamada adicional ao ERP: os números serão obtidos das chaves já carregadas em cada CT-e.
- CT-es complementares sem notas próprias continuarão mostrando `—`; não será feita herança automática das notas do CT-e original nesta listagem.

## Validação

- Conferir CT-e com uma, várias, notas repetidas e nenhuma nota.
- Testar filtro, ordenação, seletor de colunas e visualização estreita.
- Confirmar que a tabela continua cabendo e navegável com a nova coluna.
