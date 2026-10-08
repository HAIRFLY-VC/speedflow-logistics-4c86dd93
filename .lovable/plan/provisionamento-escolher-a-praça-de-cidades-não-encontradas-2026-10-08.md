# Provisionamento: escolher a praça de cidades não encontradas

Classificação: MINOR (v1.26.0).

## O que muda para o usuário
- No modal "Provisionar frete da transportadora", cada entrega com "praça não encontrada" ganha um seletor com as praças da tabela de frete (ex.: CARUARU INTERIOR, MATA SUL/NORTE).
- Ao escolher, o app grava a cidade nessa praça da tabela, recalcula o provisionamento na hora e passa a reconhecer a cidade automaticamente nas próximas rotas e na auditoria de CT-e.
- Uma cidade repetida em várias entregas é resolvida com uma única escolha.
- Abrindo a composição da entrega, aparece a praça usada e se ela veio de escolha do usuário; é possível trocar a praça (remove a cidade da praça anterior e grava na nova).

## Riscos
- Sem migração: usa o campo de observação já existente nas praças da tabela (mesmo mecanismo de "aprendizado" da auditoria de CT-e). A escolha vale para todas as transportadoras que usam aquela tabela.

## Detalhes técnicos
- `provisao-frete.types.ts`: incluir `pracas` (id, destino) da tabela no preview e `praca_id`/`origem` no detalhe.
- `frete-simulacao.ts`: `detalharEntrega` retorna id da praça e origem do critério.
- Nova server function `definirPracaMunicipio({ tabelaId, rotaId, municipio })` em `provisao-frete.functions.ts`, autenticada, usando `comMunicipioAprendido`/`semMunicipioAprendido` para atualizar `tabelas_preco_frete_rotas.observacao`.
- `ProvisaoFreteDialog.tsx`: Select na linha da entrega; ao salvar, invalida `provisao-frete` e `tabelas-frete`.
- Atualizar `version.ts` e `CHANGELOG.md`.

## Checklist para publicar
- Rota 461: escolher praça para Toritama e Garanhuns, conferir recálculo e que o botão de gravar libera.
- Sem migrações nem flags novas.
- Reverter: versão 1.25.0 no histórico; para desfazer uma escolha, trocar a praça no próprio modal.
