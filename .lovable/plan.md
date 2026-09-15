# Seletor de métrica no gráfico "Conclusões por hora do dia"

Permitir alternar o gráfico entre **Pedidos** e **Caixas**, guardando a última escolha no perfil do usuário para reabrir igual no próximo acesso.

## O que muda na tela

- No cabeçalho do card "Conclusões por hora do dia" entram dois botões pequenos: "Pedidos" e "Caixas" (o ativo fica destacado).
- O gráfico passa a desenhar a série escolhida, com a cor já usada para cada métrica no gráfico "Volume por dia" (laranja para caixas, verde para pedidos).
- A escolha é salva automaticamente ao clicar e recarregada em qualquer dispositivo no próximo acesso. Enquanto a preferência carrega, o gráfico mostra "Pedidos" como padrão.

## Detalhes técnicos

- `src/lib/ui-prefs.functions.ts`: acrescentar `getSeparacaoChartPref` / `saveSeparacaoChartPref` no mesmo padrão do sidebar, usando `table_key = "ui:separacao-hora"` em `user_table_preferences`, com `preferences = { metrica: "pedidos" | "caixas" }` e fallback `"pedidos"`.
- `src/routes/_authenticated/separacao.tsx`:
  - estado local `metricaHora`, hidratado por `useQuery` sobre `getSeparacaoChartPref` (via `useServerFn`);
  - `useMutation` chamando `saveSeparacaoChartPref` no clique (otimista, sem bloquear a UI);
  - `<Bar dataKey={metricaHora} name={...} fill={...} />` e rótulo do eixo/tooltip acompanhando a métrica.
- Nenhuma mudança no `separacao.functions.ts` — `porHora` já calcula `pedidos` e `caixas`.
