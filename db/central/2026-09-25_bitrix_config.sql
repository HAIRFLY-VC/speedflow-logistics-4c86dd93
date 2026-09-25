-- Configuração dos participantes das tarefas do Bitrix e vínculo
-- usuário do app ↔ usuário do Bitrix.

-- 1) Participantes padrão das tarefas (linha única id = 1)
create table if not exists speedflow.bitrix_task_config (
  id int primary key default 1,
  responsavel_id int,
  responsavel_nome text,
  observadores jsonb not null default '[]'::jsonb, -- [{ id: number, nome: text }]
  updated_at timestamptz not null default now(),
  constraint bitrix_task_config_single check (id = 1)
);

grant all on speedflow.bitrix_task_config to service_role;

-- O acesso a esta tabela é feito exclusivamente pelo servidor do SpeedFlow,
-- depois que o usuário administrador é validado no banco de acesso.
-- O banco central não possui a função has_role nem o tipo app_role.
revoke all on speedflow.bitrix_task_config from anon, authenticated;

alter table speedflow.bitrix_task_config enable row level security;

-- Limpa políticas que podem ter sido criadas por versões anteriores do script.
drop policy if exists "Staff le config bitrix" on speedflow.bitrix_task_config;
drop policy if exists "Adm grava config bitrix" on speedflow.bitrix_task_config;

-- Valores atuais já preenchidos na primeira vez
insert into speedflow.bitrix_task_config (id, responsavel_id, responsavel_nome, observadores)
values (1, 30, null, '[]'::jsonb)
on conflict (id) do nothing;

-- 2) Vínculo do usuário do app com o usuário do Bitrix
alter table speedflow.profiles
  add column if not exists bitrix_user_id int,
  add column if not exists bitrix_user_nome text;
