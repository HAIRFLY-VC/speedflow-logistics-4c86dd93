# Configuração dos participantes da tarefa do Bitrix

## O que muda na tela de Configurações
Nova área **"Tarefas do Bitrix"** (só administradores), com duas partes:

### 1. Participantes padrão
- **Responsável** (um usuário), **Observadores** (vários) e **Criador padrão** (usado quando quem autorizou não tem vínculo com o Bitrix).
- Cada campo abre uma lista com todos os usuários **ativos** do Bitrix (**código**, nome, cargo e e-mail), com busca digitando parte do nome ou o código.
- O código do usuário do Bitrix aparece também nos itens já escolhidos e no vínculo com o usuário do app, pois é ele que define responsável, criador e observadores da tarefa.
- Botão "Salvar". Os valores atuais (responsável 30, observadores 24, 54 e 1) já vêm preenchidos na primeira vez.

### 2. Vínculo usuário do app com usuário do Bitrix
- Tabela com os usuários do app (nome e e-mail) e, ao lado, a escolha do usuário do Bitrix correspondente (com a mesma busca por nome).
- Botão "Sugerir por e-mail": vincula automaticamente quando o e-mail é o mesmo nos dois sistemas (o administrador confere antes de salvar).
- Mostra quais usuários ainda estão sem vínculo.

## Na criação da tarefa
- O **criador** da tarefa passa a ser o usuário do Bitrix vinculado a quem autorizou o pagamento; se não houver vínculo, usa o criador padrão.
- Responsável e observadores vêm da configuração salva, não mais fixos no código.
- Vale para a tarefa normal, a de valor adicional e os reenvios da fila de pendências (o reenvio mantém o autor original).

## Observação
Para o Bitrix aceitar outro usuário como criador, o webhook usado precisa pertencer a um administrador do Bitrix e ter permissão de "usuários" além de "tarefas". Se não tiver, a lista não carrega e a tela avisa em português o que liberar no Bitrix.

## Detalhes técnicos
- Bitrix: `user.get` com `FILTER: { ACTIVE: true }`, paginado (`start`, 50 por página), cache de 10 min no servidor; busca feita no navegador sobre a lista completa.
- Banco (Lovable Cloud), migração:
  - tabela `bitrix_task_config` (linha única id=1): `responsavel_id int`, `observadores int[]`, `criador_padrao_id int`, `updated_at`; RLS leitura staff, escrita adm; GRANTs.
  - coluna `profiles.bitrix_user_id int null`.
- `src/lib/bitrix-config.functions.ts` (adm via `has_role`): `listarUsuariosBitrix`, `obterConfigBitrix`, `salvarConfigBitrix`, `salvarVinculosBitrix`.
- `bitrix-task.server.ts`: `criarTarefaBitrix` recebe `criadoPor` (id do app), lê config e vínculo, envia `CREATED_BY`, `RESPONSIBLE_ID`, `AUDITORS`; fallback para os valores atuais se a config estiver vazia.
- `rota-pagamento.server.ts` e reprocessamento da fila passam o `autorizado_por` da ordem.
- Nova seção em `src/routes/_authenticated/configuracoes.tsx` com Combobox (Command) para busca.
