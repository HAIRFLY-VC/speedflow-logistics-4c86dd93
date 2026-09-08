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

type Persistido = {
  columnFilters: ColumnFilters;
  sort: SortPref;
  visibleColumns: string[] | null;
};

/**
 * Mantém filtros por coluna + ordenação + colunas visíveis salvos no perfil
 * do usuário (tabela user_table_preferences), com gravação debounced.
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
  /** null = usar as colunas padrão da tela. */
  const [colunasVisiveis, setColunasVisiveisState] = useState<string[] | null>(null);
  const carregado = useRef(false);

  useEffect(() => {
    if (!prefsQ.isSuccess || carregado.current) return;
    const p = prefsQ.data;
    if (p?.columnFilters && typeof p.columnFilters === "object") {
      setFiltrosState(p.columnFilters as ColumnFilters);
    }
    if (p?.sort !== undefined) setSortState(p.sort ?? null);
    if (Array.isArray(p?.visibleColumns)) {
      setColunasVisiveisState(p.visibleColumns.map(String));
    }
    carregado.current = true;
  }, [prefsQ.isSuccess, prefsQ.data]);

  const salvar = useMutation({
    mutationFn: (vars: Persistido) => saveFn({ data: { tableKey, preferences: vars } }),
  });

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function persistir(next: Persistido) {
    if (!carregado.current) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => salvar.mutate(next), 500);
  }

  function setFiltro(id: string, f: ColumnFilter | undefined) {
    setFiltrosState((prev) => {
      const next = { ...prev };
      if (!f) delete next[id];
      else next[id] = f;
      persistir({ columnFilters: next, sort, visibleColumns: colunasVisiveis });
      return next;
    });
  }

  function limparFiltros() {
    setFiltrosState(() => {
      persistir({ columnFilters: {}, sort, visibleColumns: colunasVisiveis });
      return {};
    });
  }

  /** Aplica de uma vez um conjunto salvo de filtros + ordenação + colunas. */
  function aplicarConjunto(next: {
    columnFilters: ColumnFilters;
    sort: SortPref;
    visibleColumns?: string[] | null;
  }) {
    const cols = next.visibleColumns === undefined ? colunasVisiveis : next.visibleColumns;
    setFiltrosState(next.columnFilters ?? {});
    setSortState(next.sort ?? null);
    setColunasVisiveisState(cols);
    persistir({
      columnFilters: next.columnFilters ?? {},
      sort: next.sort ?? null,
      visibleColumns: cols,
    });
  }

  function setSort(next: SortPref) {
    setSortState(next);
    persistir({ columnFilters: filtros, sort: next, visibleColumns: colunasVisiveis });
  }

  function setColunasVisiveis(next: string[] | null) {
    setColunasVisiveisState(next);
    persistir({ columnFilters: filtros, sort, visibleColumns: next });
  }

  const resetar = useMutation({
    mutationFn: () => resetFn({ data: { tableKey } }),
    onSuccess: () => {
      setFiltrosState({});
      setSortState(defaultSort);
      setColunasVisiveisState(null);
    },
  });

  return {
    filtros,
    sort,
    colunasVisiveis,
    setColunasVisiveis,
    setFiltro,
    aplicarConjunto,
    limparFiltros,
    setSort,
    restaurarPadrao: () => resetar.mutate(),
    carregando: prefsQ.isLoading,
  };
}
