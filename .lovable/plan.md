# Corrigir script do calendário comercial (erro de sintaxe na política)

Classificação: PATCH (correção do script de migração, sem mudança de comportamento no app).

## Diagnóstico

O erro `42601: syntax error at or near "not"` ocorre porque o PostgreSQL **não suporta** `CREATE POLICY IF NOT EXISTS` — essa sintaxe não existe. Como o erro foi na linha 15 (a política), os comandos anteriores (tabela, índice, grants, RLS) provavelmente já foram aplicados no banco central.

## O que muda

1. **Corrigir `db/central/2026-10-03_calendario_comercial.sql`**: substituir o `create policy if not exists` por um bloco `DO $$ ... $$` que cria a política apenas se ela ainda não existir (verificando `pg_policies`), tornando o script 100% reexecutável sem erros:

```sql
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'speedflow'
      and tablename = 'erp_calendario_comercial'
      and policyname = 'Usuários autenticados leem o calendário comercial'
  ) then
    create policy "Usuários autenticados leem o calendário comercial"
      on speedflow.erp_calendario_comercial for select to authenticated using (true);
  end if;
end $$;
```

2. **Gerar nova versão do script em /mnt/documents** para você baixar e rodar novamente no banco central (pode rodar por cima — todos os comandos são idempotentes).

## Riscos e reversão

- Risco nulo: o script é idempotente; rodar de novo não duplica nem quebra nada.
- Reversão: `drop table speedflow.erp_calendario_comercial;`

## Checklist para publicar

- Rodar o script corrigido no banco central e me avisar para eu validar (sync ERP + filtro em Pedidos).
- Migração: `2026-10-03_calendario_comercial.sql` (versão corrigida).
- Flags: nenhuma.
