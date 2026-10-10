# Corrigir “Não foi possível calcular” no card % Frete — v1.37.5 (PATCH)

## Diagnóstico

O card usa a mesma consulta do painel **Custo de Frete**. Essa consulta passou a solicitar o novo campo `vendedor` do espelho de notas; se a atualização opcional do banco ainda não estiver disponível, a leitura inteira falha e o card mostra apenas “Não foi possível calcular”. A confirmação final será feita reproduzindo a requisição no preview e conferindo a resposta real.

## O que muda

1. Tornar a leitura do custo compatível com as duas estruturas do banco:
   - primeiro tentar carregar os dados com o nome do vendedor;
   - se somente esse novo campo estiver indisponível, repetir a leitura sem ele e manter o código do vendedor.
2. Preservar os critérios atuais do cálculo: agendas 417/427, ciclo comercial, frete real ou provisionado e consolidação de reentregas.
3. Manter erros reais visíveis: o fallback não esconderá falhas de acesso, conexão ou outros campos.
4. Atualizar a versão de `1.37.4` para `1.37.5` e registrar a correção no changelog.

## Risco para a versão publicada

Baixo. A correção é somente de leitura e compatibilidade. Não altera valores, banco, integrações ou regras de cálculo.

## Verificação

- Abrir **Rotas Pendentes** e confirmar que o card volta a mostrar percentual, frete e mercadorias.
- Abrir **Custo de Frete** no mesmo ciclo e conferir que os valores são iguais aos do card.
- Confirmar que nomes aparecem quando disponíveis e que códigos continuam funcionando quando o nome não estiver gravado.
- Validar compilação e ausência de novos erros no preview.

## Checklist para publicar

- **Teste manual:** conferir o card e o painel no ciclo atual.
- **Migrações:** nenhuma será aplicada nesta correção; o script opcional do nome do vendedor permanece separado.
- **Flags:** nenhuma.
- **Reversão:** voltar para a v1.37.4 no histórico do Lovable; não há SQL de reversão.