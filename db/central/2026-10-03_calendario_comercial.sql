-- Calendário comercial do ERP (tabela GKS.A_CADCTABE, chaves 050FATPED-%):
-- cada mês comercial corresponde a um período de datas (de/ate).
-- Atualizado pelo Sync ERP. Reversão: drop table speedflow.erp_calendario_comercial;
create table if not exists speedflow.erp_calendario_comercial (
  mes_comerc date primary key,       -- primeiro dia do mês comercial
  de date not null,                  -- início do período
  ate date not null,                 -- fim do período
  atualizado_em timestamptz not null default now()
);
create index if not exists erp_calendario_comercial_periodo_idx
  on speedflow.erp_calendario_comercial (de, ate);
grant all on speedflow.erp_calendario_comercial to service_role;
grant select on speedflow.erp_calendario_comercial to authenticated;
alter table speedflow.erp_calendario_comercial enable row level security;
create policy if not exists "Usuários autenticados leem o calendário comercial"
  on speedflow.erp_calendario_comercial for select to authenticated using (true);
