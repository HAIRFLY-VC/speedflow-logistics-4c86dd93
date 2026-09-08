import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import {
  getTablePrefs,
  resetTablePrefs,
  saveTablePrefs,
} from "@/lib/table-prefs.functions";
import type { ColumnFilter, ColumnFilters } from "./column-filters";

export type SortPref = { id: string; dir: "asc" | "desc" } | null;

/**
 * Mantém filtros por coluna + ordenação salvos no perfil do usuário
 * (tabela user_table_preferences), com gravação debounced.
 */
export function useColumnFilterPrefs(tableKey: string, defaultSort: SortPref = null) {
  const getFn = useServerFn(getTablePrefs);
  const saveFn = useServerFn(saveTablePrefs);
  const resetFn = useServerFn(resetTablePrefs);

  const prefsQ = useQuery({
    queryKey: ["table-prefs", tableKey],
    queryFn: () => getFn({ data: { tableKey } }),
    staleTime: 5 * 60 * 1000,
  });

  const [filtros, setFiltrosState] = useState<ColumnFilters>({});
  const [sort, setSortState] = useState<SortPref>(defaultSort);
  const carregado = useRef(false);

  useEffect(() => {
    if (!prefsQ.isSuccess || carregado.current) return;
    const p = prefsQ.data;
    if (p?.columnFilters && typeof p.columnFilters === "object") {
      setFiltrosState(p.columnFilters as ColumnFilters);
    }
    if (p?.sort !== undefined) setSortState(p.sort ?? null);
    carregado.current = true;
  }, [prefsQ.isSuccess, prefsQ.data]);

  const salvar = useMutation({
    mutationFn: (vars: { columnFilters: ColumnFilters; sort: SortPref }) =>
      saveFn({ data: { tableKey, preferences: vars } }),
  });

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function persistir(next: { columnFilters: ColumnFilters; sort: SortPref }) {
    if (!carregado.current) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => salvar.mutate(next), 500);
  }

  function setFiltro(id: string, f: ColumnFilter | undefined) {
    setFiltrosState((prev) => {
      const next = { ...prev };
      if (!f) delete next[id];
      else next[id] = f;
      persistir({ columnFilters: next, sort });
      return next;
    });
  }

  function limparFiltros() {
    setFiltrosState(() => {
      persistir({ columnFilters: {}, sort });
      return {};
    });
  }

  /** Aplica de uma vez um conjunto salvo de filtros + ordenação. */
  function aplicarConjunto(next: { columnFilters: ColumnFilters; sort: SortPref }) {
    setFiltrosState(next.columnFilters ?? {});
    setSortState(next.sort ?? null);
    persistir({ columnFilters: next.columnFilters ?? {}, sort: next.sort ?? null });
  }

  function setSort(next: SortPref) {
    setSortState(next);
    persistir({ columnFilters: filtros, sort: next });
  }

  const resetar = useMutation({
    mutationFn: () => resetFn({ data: { tableKey } }),
    onSuccess: () => {
      setFiltrosState({});
      setSortState(defaultSort);
    },
  });

  return {
    filtros,
    sort,
    setFiltro,
    aplicarConjunto,
    limparFiltros,
    setSort,
    restaurarPadrao: () => resetar.mutate(),
    carregando: prefsQ.isLoading,
  };
}
