# Limpar campo de responsável na edição de rota

## Objetivo
Permitir ao usuário remover a transportadora/fretista/frota própria selecionada no modal de edição de rota, deixando o campo vazio quando necessário.

## Contexto
- O modal `src/components/routes/RouteEditDialog.tsx` usa um `Command`/`Popover` para selecionar o responsável (campo `codFrtTrp`).
- Hoje não há ação para desfazer a seleção; uma vez escolhido um responsável, não é possível voltar a "Sem responsável".
- A UI já exibe `Selecione o responsável` quando `codFrtTrp` é `null`.

## Plano de implementação
1. **UI do campo**
   - Adicionar um botão pequeno de "limpar" ao lado do `ChevronsUpDown` no trigger do combobox (visível apenas quando houver seleção).
   - Ao clicar, definir `codFrtTrp` como `null`.
   - Evitar que o clique abra o popover.

2. **Persistência local (Supabase)**
   - No salvamento, permitir que `driver_name` e `codFrtTrp` sejam enviados como `null` quando o campo estiver limpo.
   - Atualizar o registro da rota no banco central removendo `driver_name`.

3. **Replicação ao ERP**
   - Verificar `src/lib/rota-erp.functions.ts` (`atualizarCapaRotaErp`) e garantir que `codFrtTrp` nulo/vazio seja enviado ao endpoint Oracle como `null` (ou vazio, conforme a API espera), sem causar erro de validação.
   - O endpoint `/v1/execute/update_capa_rota` deve receber `cod_frt_trp` vazio quando o campo for limpo.

4. **Validação**
   - Testar que o campo exibe "Selecione o responsável" após limpar.
   - Testar que o salvamento com campo limpo remove o vínculo no ERP e no banco local.
   - Testar que o botão de limpar não quebra o layout mobile (quebra de linha mantida).

## Escopo
Apenas o modal de edição de rota (`RouteEditDialog.tsx`) e a função server `atualizarCapaRotaErp` serão alterados.
