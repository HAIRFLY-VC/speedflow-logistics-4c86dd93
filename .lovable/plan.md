# Configuração dos participantes da tarefa do Bitrix

## O que muda na tela de Configurações
Nova área **"Tarefas do Bitrix"** (só administradores), com duas partes:

### 1. Participantes padrão
- **Responsável** (um usuário) e **Observadores** (vários). O criador é sempre quem autorizou o pagamento (ver abaixo).
- Cada campo abre uma lista com todos os usuários **ativos** do Bitrix (**código**, nome, cargo e e-mail), com busca digitando parte do nome ou o código.
- O código do usuário do Bitrix aparece também nos itens já escolhidos e no vínculo com o usuário do app, pois é ele que define responsável, criador e observadores da tarefa.
- Botão "Salvar". Os valores atuais (responsável 30, observadores 24, 54 e 1) já vêm preenchidos na primeira vez, sempre mostrando código e nome de cada usuário (ex.: "30 — Nome do usuário"), buscados no Bitrix.

### 2. Vínculo usuário do app com usuário do Bitrix
- Tabela com os usuários do app (nome e e-mail) e, ao lado, a escolha do usuário do Bitrix correspondente (com a mesma busca por nome).
- Botão "Sugerir por e-mail": vincula automaticamente quando o e-mail é o mesmo nos dois sistemas (o administrador confere antes de salvar).
- Mostra quais usuários ainda estão sem vínculo.

## Na criação da tarefa
- O **criador** da tarefa é sempre o usuário do Bitrix vinculado a quem autorizou o pagamento.
- **Vínculo obrigatório:** se quem vai autorizar não tiver vínculo com o Bitrix, o botão "Confirmar Pgto" fica visível mas desabilitado, com um aviso abaixo: "Seu usuário não está vinculado ao Bitrix. Peça ao administrador para fazer o vínculo em Configurações." O servidor também recusa a confirmação nesse caso.
- Reenvios de pendências antigas cujo autor não tenha vínculo ficam na fila com essa mensagem até o vínculo ser feito.
- Responsável e observadores vêm da configuração salva, não mais fixos no código.
- Vale para a tarefa normal, a de valor adicional e os reenvios da fila de pendências (o reenvio mantém o autor original).

## Observação (verificado em 25/09, 09:17)
Webhook definitivo informado pelo usuário: `https://hairfly.bitrix24.com.br/rest/1/vudzzdzvccplzbep/` — pertence a Lucas Sultanum (código 1), administrador do Bitrix, então o Bitrix aceita outro usuário como criador. Testado agora: permissões OK (`task`, `tasks_extended`, `user_basic`, `user_brief`, `disk`) e a **lista de usuários ativos carregou com sucesso** (`user.get` retornou Lucas, Wagner, Letyane etc.).

**Na implementação:** atualizar o endereço do webhook do Bitrix no app para este novo (chave `vudzzdzvccplzbep`).

## Detalhes técnicos
- Bitrix: `user.get` com `FILTER: { ACTIVE: true }`, paginado (`start`, 50 por página), cache de 10 min no servidor; busca feita no navegador sobre a lista completa.
- Banco (Lovable Cloud), migração:
  - tabela `bitrix_task_config` (linha única id=1): `responsavel_id int`, `responsavel_nome text`, `observadores jsonb` (código+nome), `updated_at`; RLS leitura staff, escrita adm; GRANTs.
  - colunas `profiles.bitrix_user_id int null` e `profiles.bitrix_user_nome text null`.
- `src/lib/bitrix-config.functions.ts` (adm via `has_role`): `listarUsuariosBitrix`, `obterConfigBitrix`, `salvarConfigBitrix`, `salvarVinculosBitrix`; `meuVinculoBitrix` para qualquer usuário logado.
- `bitrix-task.server.ts`: `criarTarefaBitrix` recebe `criadoPor` (id do app), exige vínculo (erro em PT-BR se ausente), envia `CREATED_BY`, `RESPONSIBLE_ID`, `AUDITORS`; responsável/observadores caem nos valores atuais se a config estiver vazia.
- `confirmarPagamentoRota` valida o vínculo antes de gravar; `RotasView`/`PagamentoRotaDialog` desabilitam o botão com aviso.
- `rota-pagamento.server.ts` e reprocessamento da fila passam o `autorizado_por` da ordem.
- Nova seção em `src/routes/_authenticated/configuracoes.tsx` com Combobox (Command) para busca.
