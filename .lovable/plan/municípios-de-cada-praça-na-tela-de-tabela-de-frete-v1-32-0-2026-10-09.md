# Municípios de cada praça na tela de Tabela de Frete (v1.32.0, MINOR)

## O que muda para o usuário
- Na edição da tabela de frete, em "Preços por origem e destino", cada linha de praça ganha um botão "Municípios (N)" com a quantidade de cidades.
- Ao clicar, abre uma janela com a lista de municípios da praça:
  - campo de busca (sem diferenciar acento e maiúscula);
  - adicionar um ou vários municípios de uma vez (separados por vírgula, ponto e vírgula ou um por linha);
  - remover um município com um clique no "x";
  - aviso quando o município já está em outra praça da mesma tabela, com opção de movê-lo para esta.
- As alterações são gravadas ao clicar em "Salvar" na tabela, como os outros campos.
- O provisionamento de rotas e a auditoria de CT-e passam a usar a lista mantida aqui.

## Correção importante incluída
Hoje, ao salvar a tabela de frete, as praças são apagadas e gravadas de novo sem a observação, que guarda a lista de municípios. Por isso, salvar a tabela TABELA-FRACIONADA apagaria as cidades cadastradas a partir da planilha. A gravação passa a manter a observação e a lista de municípios.

## Riscos
- Não muda a estrutura do banco. Usa o campo de observação que já existe.
- Como o banco é compartilhado, as alterações nos municípios passam a valer na hora também na versão publicada.

## Detalhes técnicos
- `tabelas-frete.tsx`: `RotaDraft` ganha `observacao` e `municipios: string[]`. A carga usa `municipiosAprendidos`. Ao salvar, a observação é montada com `comMunicipioAprendido` ou reescreve a linha `MUNICIPIOS:` e inclui `observacao` na inserção.
- Novo componente `src/components/tabelas-frete/MunicipiosPracaDialog.tsx`, com normalização por `normalizeArea`.
- Detecção de duplicidade entre as praças da tabela em edição.
- `version.ts` 1.32.0 e `CHANGELOG.md`.

## Checklist para publicar
- Abrir TABELA-FRACIONADA, conferir as contagens (ex.: CARUARU INTERIOR com cerca de 70), adicionar e remover um município, salvar, reabrir e confirmar.
- Salvar sem mexer nos municípios e confirmar que as listas continuam lá.
- Não há migrações nem flags.
- Para reverter, voltar à versão 1.31.0. O script de restauração das praças já foi entregue.
