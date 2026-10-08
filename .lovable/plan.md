# Permissão da sequence SEQ_PROVISAO_FRETE para o usuário da API

## Classificação
PATCH (1.28.1) — apenas um script SQL para o DBA rodar no Oracle do ERP; nenhuma alteração no código do app ou no banco do app.

## Contexto
O provisionamento de frete (v1.28.0) consulta `GKS.SEQ_PROVISAO_FRETE.NEXTVAL` antes de cada insert em `A_GER_PROVISAO_FRETE`. Sem permissão na sequence, a gravação falha com ORA-01031 (privilégios insuficientes).

## O que será entregue
Script Oracle `db/erp/2026-10-08_grant_seq_provisao_frete.sql` (com cópia em /mnt/documents e link de download) contendo:

```sql
-- Concede ao usuário usado pela API do ERP permissão de leitura
-- na sequence que numera os provisionamentos de frete.
-- Executar conectado como GKS (dono da sequence) ou como DBA.

GRANT SELECT ON GKS.SEQ_PROVISAO_FRETE TO <USUARIO_API>;
```

- `<USUARIO_API>` será substituído pelo nome do usuário Oracle que a API do ERP usa (o mesmo que já executa `insert_provisao_frete` e `update_status_provisao`). Se você me informar o nome, deixo o script pronto; caso contrário entrego com o placeholder destacado.
- SELECT em sequence é o privilégio que libera `NEXTVAL`/`CURRVAL` no Oracle — não existe grant específico de "EXECUTE" para sequences.

## Impacto na versão publicada
Nenhum. O script roda no Oracle do ERP, fora do app, e só adiciona permissão (nada é removido ou alterado).

## Como reverter
```sql
REVOKE SELECT ON GKS.SEQ_PROVISAO_FRETE FROM <USUARIO_API>;
```

## Checklist para publicar
- DBA executa o script no Oracle (como GKS ou DBA).
- Testar no preview: abrir o provisionamento de uma rota de transportadora sem gravação e clicar em "Gravar provisionamento no ERP".
- Sem migrações no banco do app e sem flags novas.
