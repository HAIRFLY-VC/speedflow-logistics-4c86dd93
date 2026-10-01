# Excluir as 2 rotas sem ERP e deixar de criar a rota "NÃO PLANEJADO"

## O que muda para o usuário

- Somem do app as rotas `rota-teste-20261001` (vazia) e `nao-planejado-40000101` ("NÃO PLANEJADO").
- A sincronização com o ERP deixa de recriar a rota "NÃO PLANEJADO". Pedidos sem rota no ERP continuam aparecendo normalmente em **Pedidos sem rota** e no card pulsante de **Rotas Pendentes**: essas telas usam a data do próprio pedido, não essa rota.

Classificação: **PATCH** (v1.14.4).

## Passos

1. **Código: sincronização** (`src/lib/erp-sync.server.ts`, por volta da linha 891): quando o pedido não tiver nome nem ID de rota no ERP, ignorá-lo no agrupamento de rotas (`continue`) em vez de montar o grupo "NÃO PLANEJADO". O pedido continua sendo gravado com a data 4000-01-01, então segue listado como "sem rota".
2. **Dados no banco central**, uma única vez, depois que o código novo estiver ativo:
   - remover os vínculos de pedidos (`route_orders`) e os manifestos (`delivery_manifests`) dessas 2 rotas;
   - apagar as 2 rotas de `routes`.
   Os 2 pedidos que estavam em "NÃO PLANEJADO" ficam sem rota e aparecem em **Pedidos sem rota**. Nenhum pedido é apagado.
3. Comentário da linha 1032 atualizado (não cita mais o "NÃO PLANEJADO").
4. Atualizar `version.ts` para 1.14.4 e adicionar a entrada no `CHANGELOG.md` (seção "Removido": rota "NÃO PLANEJADO" deixa de existir).

## Riscos

- O banco é compartilhado: se a versão publicada sincronizar antes do Publish, ela recria a rota "NÃO PLANEJADO". Por isso a limpeza (passo 2) deve ser repetida logo depois do Publish, ou feita só depois dele.
- As referências restantes à data 4000-01-01 em telas como Autorizar, detalhe da rota e Rotas Pendentes servem apenas para exibir "Não planejado" e ficam sem efeito. Elas permanecem por segurança.

## Checklist para publicar

- No preview, executar a sincronização e conferir que "NÃO PLANEJADO" não volta em **Rotas Pendentes**.
- Conferir se os 2 pedidos aparecem em **Pedidos sem rota**.
- Migrações: nenhuma (só exclusão pontual de dados).
- Flags: nenhuma.
- Como reverter: voltar para a versão anterior no histórico do Lovable; a próxima sincronização recria a rota "NÃO PLANEJADO". A rota de teste não precisa ser recuperada.
