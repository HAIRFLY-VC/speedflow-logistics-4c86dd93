# Ocultar card sem pedidos pendentes

## Classificação e versão
- **PATCH:** corrigir a condição de exibição sem mudar o fluxo existente.
- Atualizar a versão de **1.16.7 para 1.16.8** e registrar no `CHANGELOG.md`.

## Diagnóstico confirmado
- O card atualmente é exibido sempre que a funcionalidade está ativa em **Rotas Pendentes**.
- A condição não verifica se a consulta retornou pedidos; por isso ele continua visível com todos os totais zerados.

## O que será feito
- Exibir **Pedidos pendentes sem rota** somente após a consulta terminar com sucesso e retornar ao menos um pedido.
- Ocultar o card quando não houver pedidos sem rota.
- Manter o card pulsante, os totais e o acesso à tela **Pedidos sem rota** quando houver pendências.
- Durante carregamento ou erro da consulta, não mostrar um card zerado que possa indicar uma pendência inexistente.
- Ajustar automaticamente a grade para os quatro indicadores ocuparem toda a linha quando o card estiver oculto.

## Validação
- Conferir em **Rotas Pendentes** que o card não aparece com zero pedidos sem rota.
- Conferir que ele reaparece com valores corretos quando houver ao menos um pedido sem rota.
- Validar a disposição dos indicadores em computador e celular.

## Risco e reversão
- **Risco baixo:** alteração somente visual, sem banco, dados ou integrações.
- Reversão pelo histórico do Lovable para a versão anterior; não há SQL para desfazer.

## Checklist para publicar
- Testar no preview os cenários com zero e com ao menos um pedido sem rota.
- **Migrações aplicadas:** nenhuma.
- **Flags após publicar:** nenhuma ação; a correção seguirá ativa na versão oficial.
- Se houver problema, restaurar a versão anterior pelo histórico do Lovable.
