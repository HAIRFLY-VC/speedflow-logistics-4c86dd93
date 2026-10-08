# Exibir críticas do provisionamento na listagem de rotas

**Classificação:** PATCH — versão proposta `1.27.2`.

## Objetivo

Na tela **Autorizar pagamento de frete**, mostrar diretamente em cada rota de transportadora os motivos pelos quais o provisionamento não pôde ser calculado, sem exigir que o usuário abra o lápis para descobrir o problema.

## Implementação

1. Consolidar, para cada rota do tipo **T**, as críticas já identificáveis na listagem:
   - transportadora responsável não encontrada no cadastro;
   - transportadora sem tabela de frete vigente;
   - ausência de entregas válidas para cálculo;
   - cidade/município ausente nos dados do cliente;
   - praça não encontrada para uma ou mais entregas;
   - cálculo parcial, informando quantas entregas foram calculadas e quantas ficaram pendentes.
2. Exibir as críticas abaixo do valor de frete, com ícone de alerta e destaque visual, incluindo texto completo ao posicionar o mouse.
3. Quando houver cálculo parcial, manter o valor estimado das entregas calculadas, mas sinalizar claramente que ele não representa toda a rota.
4. Quando nenhuma entrega puder ser calculada, manter o frete sem valor e mostrar o motivo específico em vez de apenas “—”.
5. Manter o lápis como caminho para corrigir a associação da tabela ou selecionar a praça correspondente.
6. Atualizar a versão para `1.27.2` e registrar a correção no changelog.

## Detalhes técnicos

- Reaproveitar os dados e o motor de simulação já carregados pela listagem; não alterar a fórmula de frete.
- Ampliar o resultado resumido da simulação para carregar os motivos por entrega, evitando executar o provisionamento completo no servidor para cada linha.
- Aplicar a indicação apenas no fluxo de autorização de pagamento, sem poluir as demais visualizações de rotas.
- Não requer alteração no banco nem chamada adicional ao ERP.

## Riscos para a versão publicada

- **Baixo:** mudança apenas de diagnóstico e apresentação; valores e gravação do provisionamento permanecem inalterados.
- Não há migração, alteração de dados ou integração externa nova.
- Correção disponível igualmente em teste e produção após a publicação, sem nova flag.

## Validação

- Conferir uma rota sem transportadora identificada.
- Conferir uma rota sem tabela vigente.
- Conferir uma rota com todas as praças resolvidas.
- Conferir uma rota parcialmente calculada e outra sem nenhuma praça resolvida.
- Confirmar que o valor parcial nunca aparece como se fosse o total definitivo.
- Validar a listagem sem rolagem lateral adicional e o texto completo no popup.

## Checklist para publicar

- **Testar no preview:** críticas por rota, popup, cálculo parcial e acesso pelo lápis.
- **Migrações aplicadas:** nenhuma.
- **Flags após Publish:** nenhuma.
- **Reversão:** restaurar a versão anterior pelo histórico do Lovable; não há SQL para reverter.
