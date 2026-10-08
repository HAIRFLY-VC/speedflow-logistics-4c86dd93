# Rota 459 fora de "Autorizar pagamento de frete"

## Diagnóstico (confirmado no banco)
- A rota 459 existe no app: data 08/10/2026, status ERP "P" (planejada), sem fretista/transportadora vinculado, frete R$ 0,00.
- Ela tem **zero pedidos vinculados** no app.
- A tela só lista rotas com pedidos, todos com borderô informado e ao menos um expedido. Sem pedidos, a 459 fica de fora (regra da v1.15.2).

## Causa provável (ainda não confirmada)
A rota foi criada hoje e ainda está "P" no ERP. Duas possibilidades:
1. Ainda não tem pedidos no ERP: está certo ela não aparecer.
2. Já tem pedidos no ERP, mas o Sync ainda não trouxe esses pedidos para o app.

## O que será feito
1. Consultar no ERP (`A_GER_ROTAS_PEDIDOS`) os pedidos da rota 459 e o borderô de cada um.
2. Se houver pedidos no ERP e não no app: rodar a importação desses pedidos e verificar por que o Sync não os trouxe. Se for falha do Sync, corrigir.
3. Depois da importação, a rota só aparece quando todos os pedidos tiverem borderô e ao menos um estiver expedido. Se faltar isso, informar ao usuário o que falta.
4. Se for preciso mudar código: versão PATCH e entrada no CHANGELOG.

## Checklist para publicar
- Preview: procurar a rota 459 depois do Sync ERP.
- Migrações: nenhuma.
- Flags: nenhuma.
- Reverter: pelo histórico do Lovable.
