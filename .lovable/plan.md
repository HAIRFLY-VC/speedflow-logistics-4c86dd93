# Corrigir ORA-01031 na gravação do provisionamento (permissão da sequence)

## Diagnóstico (confirmado pelo print)
Ao clicar em "Gravar provisionamento no ERP" (rota 453), a API do ERP retornou:
`ERP 400: "Erro Oracle: ORA-01031: insufficient privileges" (requestId 81a93df9-01ae-4f7e-a4e6-42cf6cecb22f)`.

O app chama primeiro `SELECT GKS.SEQ_PROVISAO_FRETE.NEXTVAL FROM DUAL` e depois `insert_provisao_frete`. O ORA-01031 indica que o usuário Oracle usado pela API não tem permissão em algum desses objetos — quase certamente a sequence `SEQ_PROVISAO_FRETE` (recem-criada) e/ou a tabela `A_GER_PROVISAO_FRETE`.

## Classificação
PATCH (1.28.1) — script SQL para o DBA rodar no Oracle do ERP; nenhuma alteração no código do app ou no banco do app.

## O que será entregue
Script Oracle `db/erp/2026-10-08_grant_provisao_frete.sql` (com cópia em /mnt/documents e link de download):

```sql
-- Executar conectado como GKS (dono dos objetos) ou como DBA.
-- Substitua <USUARIO_API> pelo usuário Oracle que a API do ERP utiliza
-- (o mesmo que já executa insert_ger_rota, insert_pedido_na_rota etc.).

-- Permite ler o próximo número do provisionamento (NEXTVAL/CURRVAL)
GRANT SELECT ON GKS.SEQ_PROVISAO_FRETE TO <USUARIO_API>;

-- Permite consultar, gravar, alterar e excluir provisionamentos
GRANT SELECT, INSERT, UPDATE, DELETE ON GKS.A_GER_PROVISAO_FRETE TO <USUARIO_API>;
```

- No Oracle, SELECT em sequence é o privilégio que libera NEXTVAL — não existe "EXECUTE" para sequence.
- Se o DBA confirmar que a tabela já tem grant (o insert chegou a funcionar em algum teste), a linha da tabela pode ser omitida; a da sequence é obrigatória.
- Se você me informar o nome do usuário da API, deixo o script pronto sem placeholder.

## Validação após o grant
Simular a gravação no preview: abrir o provisionamento da rota 453 e clicar em "Gravar provisionamento no ERP". Se ainda falhar, o requestId do novo erro permite ao DBA localizar no log do Oracle qual objeto segue sem permissão.

## Impacto na versão publicada
Nenhum. O script roda no Oracle do ERP, fora do app, e só adiciona permissões.

## Como reverter
```sql
REVOKE SELECT ON GKS.SEQ_PROVISAO_FRETE FROM <USUARIO_API>;
REVOKE SELECT, INSERT, UPDATE ON GKS.A_GER_PROVISAO_FRETE FROM <USUARIO_API>;
```

## Checklist para publicar
- DBA executa o script no Oracle (como GKS ou DBA).
- Testar no preview: gravar o provisionamento da rota 453 e reabrir para ver os valores gravados.
- Sem migrações no banco do app e sem flags novas.
