# Ajustes na tela de cadastro de rota ("Nova rota")

## O que muda

No formulário "Nova rota" (botão na tela Rotas Pendentes):

1. **Remover o campo "Frete total (R$)"** — a rota passa a ser criada com frete zerado; o valor continua sendo definido depois, no fluxo de pagamento/edição já existente.
2. **Substituir o campo de texto "Motorista" por uma lista pesquisável** de fretistas/transportadoras/frota própria, igual à usada na edição de rota:
   - Busca por **parte do nome** ou **código** do responsável.
   - Cada item mostra razão social, código ERP e tipo (Fretista / Transportadora / Frota própria).
   - Ao selecionar, o nome do responsável é gravado na rota (campo `driver_name`) e o código ERP fica guardado em `erp_carrier_code`, permitindo a pré-seleção correta na edição posterior.
   - Botão "X" para limpar a seleção.
3. **Remover o campo "Observações"** — a rota passa a gravar internamente a observação padrão "Rota {nome}", como já acontece hoje quando o campo fica vazio.

Campos que permanecem: Nome da rota e Data planejada de saída.

## Classificação

MINOR (1.13.0) — mudança de formulário compatível com o fluxo atual; sem alteração de banco de dados ou integrações.

## Detalhes técnicos

- Arquivo alterado: `src/components/routes/RotasView.tsx` (componente do diálogo "Nova rota", linhas ~2030-2112).
- Reutiliza o padrão já existente em `RouteEditDialog.tsx`: `Popover` + `Command` com busca, dados de `listarResponsaveisErp` (`src/lib/rota-erp.functions.ts`).
- Insert em `routes`: remove `total_freight` informado (usa 0) e `notes` digitado (usa `Rota {nome}`); adiciona `erp_carrier_code` com o código selecionado.
- Atualiza `src/config/version.ts` para 1.13.0 e `CHANGELOG.md`.

## Checklist para publicar

- Testar no preview: criar rota buscando o responsável por nome e por código; confirmar que a rota é criada sem frete e sem observação.
- Confirmar que a edição da rota criada abre com o responsável já pré-selecionado.
- Migrações: nenhuma. Flags: nenhuma.
- Reversão: restaurar a v1.12.0 pelo histórico do Lovable.
