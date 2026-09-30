-- Cache de coordenadas de bairros/cidades (Google Maps) usado como
-- aproximação de distância quando o endereço exato do cliente não é localizado.
-- Reversão: drop table speedflow.geo_localidades;
create table if not exists speedflow.geo_localidades (
  chave text primary key,            -- "UF|CIDADE|BAIRRO" (bairro vazio = cidade)
  uf text not null,
  cidade text not null,
  bairro text not null default '',
  lat double precision,
  lng double precision,
  fonte text not null default 'google',
  atualizado_em timestamptz not null default now()
);
grant all on speedflow.geo_localidades to service_role;
revoke all on speedflow.geo_localidades from anon, authenticated;
alter table speedflow.geo_localidades enable row level security;
