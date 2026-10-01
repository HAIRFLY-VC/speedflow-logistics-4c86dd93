# Mostrar rota recém-criada na listagem de Rotas Pendentes

## Causa
A lista de rotas (`RotasView`) descarta qualquer rota sem pedidos associados — regra criada para a tela "Autorizar pagamento de frete". Como uma rota recém-criada ainda não tem pedidos, ela some da tela "Rotas Pendentes" mesmo após a atualização da lista (que já acontece).

## Mudanças (PATCH → v1.15.6)

1. **`src/components/routes/RotasView.tsx`**
   - Transformar o filtro "ocultar rotas sem pedidos" em uma opção da tela (nova propriedade `ocultarRotasVazias`, desligada por padrão).
2. **`src/routes/_authenticated/autorizar-pagamento-frete.tsx`**
   - Passar `ocultarRotasVazias` para manter o comportamento atual dessa tela (rotas sem pedidos continuam ocultas lá).
3. **`src/routes/_authenticated/rotas.index.tsx` (Rotas Pendentes)**
   - Sem a opção: rotas recém-criadas aparecem imediatamente, mesmo vazias, prontas para receber pedidos.
4. Manter a atualização automática da lista após criar a rota (já existe via `onCreated`).

## Impacto na versão publicada
- Nenhum risco de banco de dados ou integração; mudança apenas de exibição.
- Efeito colateral esperado: rotas antigas criadas e nunca usadas (vazias) passarão a aparecer em Rotas Pendentes até receberem pedidos ou serem canceladas.

## Versionamento
- v1.15.6 (PATCH) + entrada no CHANGELOG.md.

## Checklist para publicar
- No preview: criar uma rota nova e confirmar que ela aparece na hora em Rotas Pendentes.
- Confirmar que "Autorizar pagamento de frete" continua sem mostrar rotas vazias.
- Nenhuma migração de banco; nenhuma flag para ligar.
- Reversão: voltar à versão anterior no histórico do Lovable.
