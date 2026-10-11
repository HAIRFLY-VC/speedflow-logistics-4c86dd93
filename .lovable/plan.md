# Crítica de divergência do provisionamento na listagem

## Classificação
**MINOR — versão proposta `1.43.0`**. Nova indicação visível na tela **Autorizar pagamento de frete**, sem alterar cálculos ou valores gravados.

## Situação confirmada
- O detalhamento aberto pelo lápis já compara o cálculo atual com o provisionamento ativo no ERP.
- A divergência já considera diferença no total, quantidade de notas ou valor de qualquer nota.
- Hoje essa crítica só aparece dentro do detalhamento; a listagem mostra apenas críticas que impedem ou deixam parcial o cálculo.

## O que será feito
1. Consultar, para as rotas de transportadora exibidas em **Autorizar pagamento de frete**, o resultado da mesma comparação já usada no detalhamento.
2. Quando houver divergência, mostrar a exclamação vermelha na coluna **Frete (R$)**, junto às demais críticas do provisionamento.
3. No popup da exclamação, exibir uma mensagem objetiva com:
   - valor total gravado no ERP;
   - valor total do cálculo atual;
   - orientação para abrir o lápis e conferir/substituir os valores.
4. Manter uma única exclamação por rota. Se houver outras críticas, todas aparecem juntas no mesmo popup.
5. Atualizar automaticamente a crítica depois de gravar ou substituir o provisionamento.

## Detalhes técnicos
- Reaproveitar a regra de divergência de `provisao-frete.server.ts`, evitando criar dois critérios diferentes.
- Criar uma consulta resumida para várias rotas, com processamento limitado em lotes e cache da tela, evitando uma chamada individual disparada por cada linha durante a renderização.
- Integrar o resumo ao mapa `criticasProvisionamento` de `RotasView.tsx` e invalidar essa consulta após alterações feitas em `ProvisaoFreteDialog.tsx`.
- A mudança permanece coberta pela flag existente `provisaoFreteTransportadora`, ativa em teste e produção conforme a política do projeto.
- Atualizar `src/config/version.ts` e `CHANGELOG.md`.

## Riscos e impacto
- **ERP:** somente consultas; nenhum valor será gravado ou substituído automaticamente.
- **Banco compartilhado:** nenhuma migração e nenhuma alteração de dados.
- **Performance:** a consulta será agrupada e limitada para não sobrecarregar a tela ao listar muitas rotas.

## Validação
- Rota com cálculo igual ao gravado: não exibe crítica de divergência.
- Rota com total diferente: exibe exclamação e os dois valores no popup.
- Rota com mesmo total, mas nota/valor por nota diferente: também exibe crítica.
- Rota sem provisionamento gravado: não exibe crítica de divergência.
- Após “Substituir pelos novos valores”, a crítica desaparece ao atualizar a listagem.
- Outras críticas existentes continuam reunidas no mesmo popup.

## Checklist para publicar
- **Testar no preview:** conferir os cinco cenários acima na tela Autorizar pagamento de frete e abrir o lápis para validar os valores.
- **Migrações aplicadas:** nenhuma.
- **Flags após Publish:** nenhuma; a flag existente já está ativa nos dois ambientes.
- **Reversão:** restaurar a versão `1.42.2` pelo histórico do Lovable; não há SQL de reversão.
