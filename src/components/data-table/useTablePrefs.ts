import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import {
  getTablePrefs,
  resetTablePrefs,
  saveTablePrefs,
  type TablePreferences,
} from "@/lib/table-prefs.functions";
import type { ColumnDef, SortState } from "./types";

export type ResolvedColumnState = {
  id: string;
  visible: boolean;
  order: number;
};

export type TableState = {
  columns: ResolvedColumnState[];
  sort: SortState;
  filters: Record<string, string>;
};

function buildDefaults<T>(columns: ColumnDef<T>[], defaultSort: SortState): TableState {
  return {
    columns: columns.map((c, idx) => ({
      id: c.id,
      visible: c.defaultVisible !== false,
      order: idx,
    })),
    sort: defaultSort ?? null,
    filters: {},
  };
}

function mergePrefs<T>(
  columns: ColumnDef<T>[],
  defaultSort: SortState,
  prefs: TablePreferences | null | undefined,
): TableState {
  const base = buildDefaults(columns, defaultSort);
  if (!prefs) return base;
  const byId = new Map(base.columns.map((c) => [c.id, c]));
  const merged: ResolvedColumnState[] = [];
  let nextOrder = 0;
  if (Array.isArray(prefs.columns)) {
    for (const p of prefs.columns) {
      const def = byId.get(p.id);
      if (!def) continue;
      merged.push({
        id: p.id,
        visible: typeof p.visible === "boolean" ? p.visible : def.visible,
        order: nextOrder++,
      });
      byId.delete(p.id);
    }
  }
  // Any new columns not yet in saved prefs go at the end.
  for (const remaining of byId.values()) {
    merged.push({ ...remaining, order: nextOrder++ });
  }
  return {
    columns: merged,
    sort: prefs.sort === null ? null : prefs.sort ?? defaultSort ?? null,
    filters: prefs.filters ?? {},
  };
}

export function useTablePrefs<T>(
  tableKey: string,
  columns: ColumnDef<T>[],
  defaultSort: SortState,
) {
  const qc = useQueryClient();
  const getFn = useServerFn(getTablePrefs);
  const saveFn = useServerFn(saveTablePrefs);
  const resetFn = useServerFn(resetTablePrefs);

  const prefsQ = useQuery({
    queryKey: ["table-prefs", tableKey],
    queryFn: () => getFn({ data: { tableKey } }),
    staleTime: 60_000,
  });

  const [state, setState] = useState<TableState>(() =>
    buildDefaults(columns, defaultSort),
  );
  const initialised = useRef(false);

  // Apply remote prefs once loaded.
  useEffect(() => {
    if (prefsQ.isSuccess && !initialised.current) {
      setState(mergePrefs(columns, defaultSort, prefsQ.data));
      initialised.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefsQ.isSuccess]);

  const saveMutation = useMutation({
    mutationFn: (preferences: TablePreferences) =>
      saveFn({ data: { tableKey, preferences } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["table-prefs", tableKey] });
    },
  });

  // Debounced persistence
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const persist = (next: TableState) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveMutation.mutate({
        columns: next.columns,
        sort: next.sort,
        filters: next.filters,
      });
    }, 400);
  };

  const update = (updater: (prev: TableState) => TableState) => {
    setState((prev) => {
      const next = updater(prev);
      if (initialised.current || prefsQ.isFetched) persist(next);
      return next;
    });
  };

  const resetMutation = useMutation({
    mutationFn: () => resetFn({ data: { tableKey } }),
    onSuccess: () => {
      const base = buildDefaults(columns, defaultSort);
      setState(base);
      qc.invalidateQueries({ queryKey: ["table-prefs", tableKey] });
    },
  });

  const orderedColumns = useMemo(() => {
    const map = new Map(state.columns.map((c) => [c.id, c]));
    // Sort columns by saved order; any column not yet in state goes to end.
    return [...columns]
      .map((c) => ({ def: c, state: map.get(c.id) }))
      .sort((a, b) => {
        const ao = a.state?.order ?? Number.MAX_SAFE_INTEGER;
        const bo = b.state?.order ?? Number.MAX_SAFE_INTEGER;
        return ao - bo;
      });
  }, [columns, state.columns]);

  return {
    state,
    setSort: (sort: SortState) => update((p) => ({ ...p, sort })),
    setFilter: (id: string, value: string) =>
      update((p) => {
        const filters = { ...p.filters };
        if (!value) delete filters[id];
        else filters[id] = value;
        return { ...p, filters };
      }),
    clearFilters: () => update((p) => ({ ...p, filters: {} })),
    toggleVisible: (id: string) =>
      update((p) => ({
        ...p,
        columns: p.columns.map((c) =>
          c.id === id ? { ...c, visible: !c.visible } : c,
        ),
      })),
    reorder: (ids: string[]) =>
      update((p) => ({
        ...p,
        columns: ids.map((id, order) => {
          const existing = p.columns.find((c) => c.id === id);
          return existing ? { ...existing, order } : { id, visible: true, order };
        }),
      })),
    reset: () => resetMutation.mutate(),
    orderedColumns,
    loaded: prefsQ.isSuccess,
  };
}
