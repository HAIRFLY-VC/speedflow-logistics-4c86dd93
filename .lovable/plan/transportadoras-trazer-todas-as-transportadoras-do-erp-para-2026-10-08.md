# Transportadoras: trazer todas as transportadoras do ERP para o cadastro

## Diagnóstico
- A tela "Transportadoras" lista apenas o cadastro próprio do app (usado para CT-e, tabela de frete e pagamento). Hoje ele tem 1 registro: SOLUTION (1044087), cadastrada manualmente.
- O espelho de responsáveis do ERP tem 28 transportadoras (natureza ET), mas elas nunca são copiadas para esse cadastro. O botão "Atualizar cadastro do ERP" só atualiza o espelho de responsáveis; não cria transportadoras.

Classificação: MINOR (v1.27.0).

## O que muda
- "Atualizar cadastro do ERP" passa também a criar no cadastro as transportadoras ET que ainda não existem (por código ERP), com razão social e CNPJ vindos do ERP, ativas por padrão.
- Transportadoras já existentes têm razão social atualizada; CNPJ, banco e tabela de frete preenchidos no app não são sobrescritos.
- Mensagem ao final: "X transportadoras criadas, Y atualizadas".
- Transportadoras sem CNPJ no ERP são criadas com CNPJ vazio e sinalizadas na listagem para completar.

## Riscos
- Insere registros no cadastro compartilhado (teste e oficial usam o mesmo banco); são dados reais do ERP, não de teste.
- Se a coluna CNPJ no banco for obrigatória, transportadoras sem CNPJ no ERP ficam de fora e são listadas na mensagem (sem alterar a estrutura do banco).

## Detalhes técnicos
- Consulta ERP: buscar CNPJ dos responsáveis ET junto da consulta já usada pelo espelho (`rota-erp.functions.ts` / `sincronizarCadastro`).
- Upsert em `transportadoras` por `cod_erp` (insert dos faltantes, update só de `razao_social`).
- Invalida `["transportadoras"]` após a sincronização.
- Atualizar `version.ts` e `CHANGELOG.md`.

## Checklist para publicar
- Clicar em "Atualizar cadastro do ERP" e conferir as 28 transportadoras na lista.
- Sem migração nem flags.
- Reverter: versão 1.26.0; registros criados podem ser inativados na própria tela.
