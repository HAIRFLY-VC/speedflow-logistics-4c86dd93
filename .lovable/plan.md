# Corrigir a importação de pedidos do ERP

Investiguei o histórico de sincronizações e as permissões do banco. Há duas causas distintas, e as duas precisam ser tratadas.

## O que está acontecendo

1. **O ERP está recusando a consulta (HTTP 502).** As duas últimas execuções (hoje 22:29 e 10:00) falharam com "ERP fora do ar (HTTP 502)" e 0 pedidos lidos. Isso vem do servidor do ERP/Cloudflare, não do app — o app já tenta 3 vezes com espera entre elas. Sem resposta do ERP, nenhum pedido entra.

2. **Mesmo que entrassem, a lista de pedidos não apareceria.** Toda leitura da tabela de pedidos está retornando erro de permissão (`permission denied for function order_belongs_to_carrier`). Uma das regras de acesso chama uma função interna que não recebeu permissão de execução para usuários logados — como o banco avalia todas as regras, a consulta falha para todo mundo, inclusive administradores. Confirmei isso direto no banco.

3. **Bug secundário já registrado no histórico:** execuções anteriores tiveram vários erros de "cliente duplicado" (mesmo código de cliente inserido duas vezes ao processar pedidos em paralelo), o que descarta esses pedidos da importação.

## O que vou fazer

**Permissão de leitura de pedidos (correção principal do lado do app)**
- Conceder execução da função interna de verificação de fretista aos usuários autenticados, para que as regras de acesso voltem a ser avaliadas sem erro. Pedidos e histórico de status voltam a carregar em telas, dashboard e kanban.

**Importação mais robusta**
- Trocar a inserção de cliente por uma gravação idempotente pelo código do ERP, eliminando os erros de duplicidade quando o mesmo cliente aparece em vários pedidos da mesma leva.
- Reprocessar o pedido automaticamente uma vez quando ocorrer conflito, em vez de descartá-lo.

**Diagnóstico do ERP fora do ar**
- Ao falhar por indisponibilidade, mostrar na tela a hora da tentativa e o status recebido, deixando claro que a falha é do ERP e não do app.
- Após as correções, disparar uma sincronização de teste. Se o ERP continuar em 502, o problema é do servidor do ERP e será preciso verificá-lo do lado deles; o app passará a importar assim que ele responder.

## Detalhes técnicos

- Migração: `GRANT EXECUTE ON FUNCTION private.order_belongs_to_carrier(uuid, uuid) TO authenticated;` (as funções irmãs `has_role`, `is_staff` e `pode_autorizar_frete` já têm essa concessão; só essa ficou de fora).
- `src/lib/erp-sync.server.ts`: substituir o par select/insert de `customers` por `upsert(..., { onConflict: "erp_id" })` retornando o `id`, e tratar `23505` com um novo select antes de falhar.
- Mensagem de erro do ERP exibida no toast/tela de sincronização inclui horário e status HTTP.
