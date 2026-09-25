-- Configuração dos participantes das tarefas do Bitrix e vínculo
-- usuário do app ↔ usuário do Bitrix.

-- 1) Participantes padrão das tarefas (linha única id = 1)
create table if not exists public.bitrix_task_config (
  id int primary key default 1,
  responsavel_id int,
  responsavel_nome text,
  observadores jsonb not null default '[]'::jsonb, -- [{ id: number, nome: text }]
  updated_at timestamptz not null default now(),
  constraint bitrix_task_config_single check (id = 1)
);

grant select on public.bitrix_task_config to authenticated;
grant all on public.bitrix_task_config to service_role;

alter table public.bitrix_task_config enable row level security;

create policy "Staff le config bitrix"
  on public.bitrix_task_config for select to authenticated
  using (true);

create policy "Adm grava config bitrix"
  on public.bitrix_task_config for all to authenticated
  using (public.has_role(auth.uid(), 'adm'))
  with check (public.has_role(auth.uid(), 'adm'));

-- Valores atuais já preenchidos na primeira vez
insert into public.bitrix_task_config (id, responsavel_id, responsavel_nome, observadores)
values (1, 30, null, '[]'::jsonb)
on conflict (id) do nothing;

-- 2) Vínculo do usuário do app com o usuário do Bitrix
alter table public.profiles
  add column if not exists bitrix_user_id int,
  add column if not exists bitrix_user_nome text;
