# Exibir a numeração de páginas na impressão da rota

## Objetivo
Garantir que a marcação `Página X de Y` fique visível no canto inferior direito tanto na folha mostrada no app quanto no PDF/folha impressa.

## Diagnóstico confirmado
A numeração atual está definida somente dentro de `@page @bottom-right`. Esse recurso pertence ao modo de impressão do navegador e, por isso, não aparece na pré-visualização da folha dentro do app, como mostra a imagem enviada.

## Alterações
1. Adicionar ao módulo comum de impressão um rodapé visual alinhado ao canto inferior direito da folha mostrada no app.
2. Manter a numeração paginada do navegador no rodapé de cada página impressa, no formato `Página X de Y`.
3. Ajustar o espaço inferior da folha para o rodapé não encobrir assinaturas, totais ou pedidos.
4. Evitar rodapé duplicado no PDF: a marcação da tela será ocultada na impressão, permanecendo a numeração própria de cada página impressa.
5. Atualizar a versão para **1.18.3 (PATCH)** e registrar a correção no changelog.

## Riscos para a versão publicada
- Nenhum impacto em banco de dados ou integrações.
- A mudança afeta somente a apresentação da impressão.
- Não requer feature flag, pois teste e oficial devem ficar iguais ao publicar.

## Validação
- Conferir na tela de impressão que `Página 1 de 1` aparece no canto inferior direito da folha exibida.
- Gerar uma rota com várias páginas e confirmar no PDF `Página 1 de Y`, `Página 2 de Y` e assim por diante.
- Confirmar que o rodapé não sobrepõe totais nem campos de assinatura em A4/Carta e Retrato/Paisagem.
- Confirmar que o nome sugerido do arquivo continua no padrão `RT_<rota>_<yyyyMMdd>.pdf`.

## Checklist para publicar
- Testar manualmente uma rota de uma página e outra com várias páginas no preview.
- Nenhuma migração será aplicada no banco compartilhado.
- Nenhuma flag precisa ser ligada após o Publish.
- Em caso de problema, reverter para a versão 1.18.2 pelo histórico do Lovable; não há reversão SQL.
