# Voltar para a tela de origem e atribuir responsável à rota

## 1. Seta "voltar" respeita a tela de origem
- Quem abre uma rota passa a informar de onde veio: "Rotas Pendentes" ou "Autorizar pagamento de frete".
- A seta e o texto ao lado dela mostram o nome da tela certa e voltam para ela.
- Links antigos ou abertos direto continuam voltando para "Rotas Pendentes".

## 2. Atribuir responsável quando a rota não tem
- No quadro "Responsável pelo frete", quando aparecer "Sem responsável informado.", Gestores e Administradores veem o botão "Atribuir responsável".
- O botão abre uma lista de fretistas e transportadoras do ERP, com busca por nome ou código. Cada item mostra o tipo (F, T ou P).
- Ao salvar:
  1. o app grava o responsável na rota no ERP, pelo mesmo comando que já atualiza a capa da rota (código do fretista/transportadora e nome do motorista);
  2. depois atualiza a rota no app (nome e código do responsável);
  3. em seguida recarrega o quadro, a lista de rotas e a situação de PIX e tipo.
- Funciona mesmo com borderô emitido (caso da rota 422). Muda só o responsável; nome, data e status da rota ficam como estão.
- Se o ERP recusar, aparece uma mensagem de erro e nada é alterado no app.
- Outros papéis continuam vendo só "Sem responsável informado."

## 3. Versão
- 1.3.0 (nova funcionalidade) e registro no CHANGELOG.

## Detalhes técnicos
- `RotasView.tsx`: `navigate({ to: "/rotas/$routeId", params, search: { from: "autorizar" | "pendentes" } })`, conforme o modo da tela.
- `rotas.$routeId.tsx`: `validateSearch` com `from` opcional. O `Link` de voltar usa `/autorizar-pagamento-frete` ou `/rotas`, e o texto acompanha.
- Nova server fn `atribuirResponsavelRota` em `src/lib/rota-erp.functions.ts`:
  - `requireSupabaseAuth` e checagem `has_role` adm ou gestor;
  - lê a rota no banco central (id no ERP, nome, data, status);
  - chama `/v1/execute/update_capa_rota` com os valores atuais e o novo `cod_frt_trp`/`nome_motorista`;
  - grava `erp_carrier_code` e `driver_name` em `routes`.
- UI: Popover + Command com `listarResponsaveisErp`, que já existe.
- Não há migração de banco.
