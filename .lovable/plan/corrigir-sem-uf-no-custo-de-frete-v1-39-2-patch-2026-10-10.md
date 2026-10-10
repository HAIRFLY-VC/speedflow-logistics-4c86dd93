# Corrigir "Sem UF" no Custo de Frete (v1.39.2 — PATCH)

## Motivo
A UF vem do cadastro de clientes copiado do ERP. Esse cadastro só é completado para clientes de pedidos pendentes e de entregas em aberto. Três falhas fazem clientes ficarem sem UF:
1. Os clientes das **notas faturadas** (a base do Custo de Frete) nunca são enviados para completar o cadastro.
2. No **Sync ERP manual**, a sincronização termina antes da etapa que completa o cadastro.
3. Clientes que já existem no cadastro, mas com **UF vazia**, nunca são consultados de novo.

## Correção
1. O Sync ERP passa a completar o cadastro também para os clientes das notas faturadas (agendas 417/427).
2. Essa etapa passa a rodar também no Sync manual, antes de terminar.
3. Clientes com UF ou cidade vazias são consultados novamente no cadastro do ERP (GKS.A_CADCTIPO).
4. A tela busca a UF que faltar direto no ERP para os clientes que ainda aparecerem sem ela e grava no cadastro. Assim, os dados ficam corretos já na primeira vez que a tela abrir.
5. "Sem UF" só aparece se o próprio ERP não tiver estado cadastrado. Nesse caso a linha mostra o código do cliente ao passar o mouse, para você corrigir no ERP.

## Riscos
Grava só a UF, a cidade e outros dados de cadastro que estiverem faltando no cadastro de clientes compartilhado, sem alterar a estrutura do banco. O Sync manual fica alguns segundos mais lento.

## Detalhes técnicos
- `erp-sync.server.ts`: `sincronizarNotasFaturadas` retorna o conjunto de clientes; `completarCadastroClientesFaltantes` passa a considerar faltante quem não tem registro ou tem `uf` nula; essa chamada passa para antes do `return` do modo manual.
- Nova server function `completarUfClientes(cods)` (autenticada) que consulta o ERP e faz upsert; `custo-frete.query.ts` chama para os códigos sem UF após a busca em `clientes_erp`, em ambas as telas.
- Versão 1.39.2 e CHANGELOG.

## Checklist para publicar
- Abrir Custo de Frete com os ciclos da imagem e confirmar que "Sem UF" sumiu ou ficou apenas com clientes sem estado no ERP.
- Rodar Sync ERP manual e conferir.
- Sem migração/flag. Para desfazer: voltar à v1.39.1.
