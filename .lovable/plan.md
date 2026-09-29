# Corrigir pedidos sem quilometragem — PATCH v1.11.1

## Diagnóstico confirmado

A quilometragem mostrada em **Pedidos sem rota** não vem pronta do ERP. A tela calcula a distância em linha reta entre o depósito e as coordenadas do cliente.

O traço `—` aparece quando falta uma dessas coordenadas. Na imagem, clientes como **M G DA SILVA (256994)**, **MAXIMUS (188760)** e **COMERCIAL DE ALIMENTOS (13420)** estão nessa situação, enquanto **A J MENEZES (91987)** possui coordenadas e mostra 126 km.

Há ainda uma limitação no código atual: essa tela consulta somente o cadastro geográfico do cliente e não usa como alternativa as coordenadas específicas já gravadas no pedido. A sincronização tenta completar coordenadas, mas processa no máximo 30 clientes por execução e pode pular essa etapa quando o tempo disponível está acabando. Por isso, clientes novos ou endereços ainda não localizados podem permanecer temporariamente sem quilometragem.

## Alteração proposta

1. Fazer a lista usar primeiro as coordenadas específicas do pedido e, na ausência delas, as coordenadas do cadastro do cliente.
2. Manter `—` somente quando realmente não existir nenhuma coordenada válida.
3. Exibir uma indicação discreta de **endereço não localizado** nesses casos, em vez de deixar apenas o traço sem explicação.
4. Preservar o agrupamento por cliente e a ordem hierárquica atual por distância: UF → cidade → bairro → cliente.
5. Validar os exemplos da imagem e conferir que os pedidos com coordenadas passam a apresentar km sem alterar pedidos, rotas ou endereços.

## Versão, risco e publicação

- **Versão:** PATCH `1.11.1`.
- **Banco compartilhado:** nenhuma migração e nenhuma gravação de dados.
- **Integrações:** nenhuma chamada adicional ao ERP ou envio externo.
- **Flag:** não necessária; conforme a política do projeto, a correção seguirá para a versão oficial ao publicar.
- Atualizar `version.ts` e registrar a correção no `CHANGELOG.md`.

## Checklist para publicar

- Conferir no preview clientes com km e clientes marcados como endereço não localizado.
- Confirmar que filtros, seleção e atribuição de rota continuam funcionando.
- Migrações aplicadas: nenhuma.
- Flags a ligar: nenhuma.
- Reversão: restaurar a versão `1.11.0` pelo histórico do Lovable; não há SQL de reversão.
