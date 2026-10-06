# Botão "Voltar" para a tela anterior em todas as telas secundárias (MINOR v1.23.0)

## O que muda
Hoje as telas secundárias têm botões fixos ("Pedidos", "Rotas Pendentes", "Voltar para CT-e"), que levam sempre ao mesmo lugar, mesmo que o usuário tenha vindo de outra tela (ex.: abriu um pedido a partir de Pedidos sem rota, do Kanban ou do detalhe de uma rota).

Passará a existir um único botão **"Voltar"** que retorna para a tela que realmente abriu a secundária, mantendo filtros e posição da tela anterior. Se o usuário abriu o link direto (nova aba, notificação, link do Bitrix), o botão volta para a tela "padrão" de cada caso.

## Telas secundárias cobertas
| Tela | Volta para (padrão se não houver tela anterior) |
|---|---|
| Detalhe do pedido | Pedidos |
| Detalhe da rota | Rotas Pendentes ou Autorizar pagamento (regra atual) |
| Impressão da rota | Detalhe da rota |
| Detalhe do CT-e | CT-e |
| Detalhe da NF-e | CT-e |

O texto do botão mostra para onde vai quando conhecido (ex.: "Voltar para Pedidos sem rota"); caso contrário, apenas "Voltar".

## Riscos
Nenhum impacto em banco, integrações ou permissões. Somente navegação.

## Detalhes técnicos
- Novo componente `src/components/layout/BackButton.tsx`: usa `useRouter().history` / `useCanGoBack()` do TanStack Router; se puder voltar dentro do app → `router.history.back()`; senão `<Link to={fallback}>`.
- Rótulo de origem: guardar o pathname anterior em memória (listener no `router.subscribe('onResolved')`) e mapear para o título do menu via `src/lib/menu-items.ts`.
- Substituir os botões existentes em `pedidos.$orderId.tsx`, `rotas.$routeId.tsx`, `ctes.$cteId.tsx`, `nfes.$chave.tsx` e `PrintLayout.tsx`.
- Atualizar `version.ts` e `CHANGELOG.md`.

## Checklist para publicar
- Abrir um pedido a partir de Pedidos sem rota, Kanban e detalhe da rota e conferir que "Voltar" retorna à origem com filtros.
- Abrir link direto em nova aba e conferir o retorno padrão.
- Sem migrações nem flags. Reverter: versão anterior no histórico.
