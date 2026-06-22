import { isValidElement, useEffect, useMemo, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown, Filter, X } from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";

import type { ColumnDef, DataTableProps } from "./types";
import { useTablePrefs } from "./useTablePrefs";
import { ColumnsManager } from "./ColumnsManager";

const EMPTY_KEY = "__empty__";
const EMPTY_LABEL = "(Vazio)";

function toComparable(v: unknown): string | number {
  if (v == null) return "";
  if (typeof v === "number") return v;
  if (v instanceof Date) return v.getTime();
  return String(v).toLowerCase();
}

function defaultRender<T>(col: ColumnDef<T>, row: T) {
  const v = col.accessor(row);
  if (v == null || v === "") return "—";
  return String(v);
}

function filterKey(v: unknown): string {
  if (v == null || v === "") return EMPTY_KEY;
  if (v instanceof Date) return v.toISOString();
  return String(v);
}

function formatDate(d: Date): string {
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function filterDisplay(v: unknown, filterType?: "text" | "number" | "date"): string {
  if (v == null || v === "") return EMPTY_LABEL;
  if (v instanceof Date) return formatDate(v);
  if (filterType === "date" && (typeof v === "string" || typeof v === "number")) {
    const d = new Date(v);
    if (!isNaN(d.getTime())) return formatDate(d);
  }
  return String(v);
}

function nodeToText(node: ReactNode): string | null {
  if (node == null || typeof node === "boolean") return null;
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) {
    const text = node.map(nodeToText).filter(Boolean).join("");
    return text || null;
  }
  if (isValidElement<{ children?: ReactNode }>(node)) {
    return nodeToText(node.props.children);
  }
  return null;
}

function columnFilterLabel<T>(col: ColumnDef<T>, row: T): string {
  if (col.filterLabel) return col.filterLabel(row);
  if (col.render) {
    const rendered = nodeToText(col.render(row))?.trim();
    if (rendered) return rendered;
  }
  return filterDisplay(col.accessor(row), col.filterType);
}

export function DataTable<T>(props: DataTableProps<T>) {
  const {
    tableKey,
    columns,
    data,
    isLoading,
    emptyMessage = "Nenhum registro encontrado.",
    defaultSort = null,
    rowKey,
    onRowClick,
    rowClassName,
    toolbarLeft,
    toolbarRight,
    onFilteredChange,
    groupBy,
  } = props;


  const {
    state,
    setSort,
    setFilter,
    clearFilters,
    toggleVisible,
    reorder,
    reset,
    orderedColumns,
  } = useTablePrefs(tableKey, columns, defaultSort);

  const visibleColumns = orderedColumns
    .filter(({ state: cs }) => cs?.visible !== false)
    .map(({ def }) => def);

  // Per-column distinct value catalog, computed from the full dataset.
  const distinctByColumn = useMemo(() => {
    const map = new Map<string, { key: string; label: string }[]>();
    const rows = data ?? [];
    for (const c of columns) {
      if (c.filterable === false) continue;
      const seen = new Map<string, { label: string; raw: unknown }>();
      for (const r of rows) {
        const v = c.accessor(r);
        const key = filterKey(v);
        if (seen.has(key)) continue;
        const label = columnFilterLabel(c, r);
        seen.set(key, { label, raw: v });
      }
      const arr = Array.from(seen, ([key, { label, raw }]) => ({ key, label, raw }));
      arr.sort((a, b) => {
        if (a.key === EMPTY_KEY) return 1;
        if (b.key === EMPTY_KEY) return -1;
        const av = toComparable(a.raw);
        const bv = toComparable(b.raw);
        if (av < bv) return -1;
        if (av > bv) return 1;
        return a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: "base" });
      });
      map.set(c.id, arr);
    }
    return map;
  }, [data, columns]);

  const filteredSorted = useMemo(() => {
    const rows = data ?? [];
    const activeFilters = Object.entries(state.filters).filter(
      ([, v]) => Array.isArray(v) && v.length > 0,
    );
    let out = rows;
    if (activeFilters.length) {
      const colById = new Map(columns.map((c) => [c.id, c]));
      out = out.filter((r) =>
        activeFilters.every(([id, selected]) => {
          const c = colById.get(id);
          if (!c) return true;
          const set = new Set(selected);
          return set.has(filterKey(c.accessor(r)));
        }),
      );
    }
    if (state.sort) {
      const c = columns.find((x) => x.id === state.sort!.id);
      if (c) {
        const dir = state.sort.dir === "asc" ? 1 : -1;
        out = [...out].sort((a, b) => {
          const av = toComparable(c.accessor(a));
          const bv = toComparable(c.accessor(b));
          if (av < bv) return -1 * dir;
          if (av > bv) return 1 * dir;
          return 0;
        });
      }
    }
    return out;
  }, [data, columns, state.filters, state.sort]);

  const grouped = useMemo(() => {
    if (!groupBy) return null;
    const map = new Map<string, T[]>();
    for (const r of filteredSorted) {
      const k = groupBy.accessor(r) ?? "";
      const arr = map.get(k) ?? [];
      arr.push(r);
      map.set(k, arr);
    }
    return Array.from(map.entries());
  }, [filteredSorted, groupBy]);

  const activeFilterEntries = Object.entries(state.filters).filter(
    ([, v]) => Array.isArray(v) && v.length > 0,
  );

  const colspan = visibleColumns.length || 1;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">{toolbarLeft}</div>
        <div className="flex flex-wrap items-center gap-2">
          {toolbarRight}
          <ColumnsManager
            columns={columns}
            state={state}
            toggleVisible={toggleVisible}
            reorder={reorder}
            reset={reset}
          />
        </div>
      </div>

      {activeFilterEntries.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {activeFilterEntries.map(([id, vals]) => {
            const c = columns.find((x) => x.id === id);
            const distinct = distinctByColumn.get(id) ?? [];
            const labelFor = (k: string) =>
              distinct.find((d) => d.key === k)?.label ?? (k === EMPTY_KEY ? EMPTY_LABEL : k);
            const text =
              vals.length <= 2
                ? vals.map(labelFor).join(", ")
                : `${vals.length} selecionados`;
            return (
              <Badge key={id} variant="secondary" className="gap-1">
                <span className="text-xs">
                  {c?.header ?? id}: <span className="font-normal">{text}</span>
                </span>
                <button
                  type="button"
                  onClick={() => setFilter(id, [])}
                  aria-label={`Remover filtro ${c?.header ?? id}`}
                  className="hover:opacity-70"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            );
          })}
          <Button variant="ghost" size="sm" onClick={clearFilters} className="h-6 text-xs">
            Limpar filtros
          </Button>
        </div>
      )}

      <div className="border rounded-lg overflow-clip bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              {visibleColumns.map((c) => (
                <HeaderCell
                  key={c.id}
                  column={c}
                  sort={state.sort}
                  selected={state.filters[c.id] ?? []}
                  options={distinctByColumn.get(c.id) ?? []}
                  onSort={() => {
                    if (c.sortable === false) return;
                    setSort(
                      state.sort?.id === c.id
                        ? state.sort.dir === "asc"
                          ? { id: c.id, dir: "desc" }
                          : null
                        : { id: c.id, dir: "asc" },
                    );
                  }}
                  onFilter={(v) => setFilter(c.id, v)}
                />
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={colspan}>
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : filteredSorted.length === 0 ? (
              <TableRow>
                <TableCell colSpan={colspan} className="text-center text-muted-foreground py-10">
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : grouped ? (
              grouped.map(([key, rows]) => (
                <GroupBlock
                  key={key}
                  groupKey={key}
                  rows={rows}
                  columns={visibleColumns}
                  groupBy={groupBy!}
                  rowKey={rowKey}
                  onRowClick={onRowClick}
                  rowClassName={rowClassName}
                />
              ))
            ) : (
              filteredSorted.map((r) => (
                <BodyRow
                  key={rowKey(r)}
                  row={r}
                  columns={visibleColumns}
                  onRowClick={onRowClick}
                  rowClassName={rowClassName}
                />
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function HeaderCell<T>({
  column,
  sort,
  selected,
  options,
  onSort,
  onFilter,
}: {
  column: ColumnDef<T>;
  sort: { id: string; dir: "asc" | "desc" } | null;
  selected: string[];
  options: { key: string; label: string }[];
  onSort: () => void;
  onFilter: (v: string[]) => void;
}) {
  const isSorted = sort?.id === column.id;
  const alignClass =
    column.align === "right"
      ? "text-right"
      : column.align === "center"
        ? "text-center"
        : "";
  return (
    <TableHead className={`${alignClass} ${column.headerClassName ?? ""} sticky top-0 z-10 bg-card`}>
      <div
        className={`flex items-center gap-1 ${
          column.align === "right"
            ? "justify-end"
            : column.align === "center"
              ? "justify-center"
              : ""
        }`}
      >
        <button
          type="button"
          onClick={onSort}
          disabled={column.sortable === false}
          className={`inline-flex items-center gap-1 ${column.sortable === false ? "cursor-default" : "hover:text-foreground"}`}
        >
          <span>{column.header}</span>
          {column.sortable !== false && (
            <span className="text-muted-foreground">
              {isSorted ? (
                sort!.dir === "asc" ? (
                  <ArrowUp className="h-3 w-3" />
                ) : (
                  <ArrowDown className="h-3 w-3" />
                )
              ) : (
                <ChevronsUpDown className="h-3 w-3 opacity-40" />
              )}
            </span>
          )}
        </button>
        {column.filterable !== false && (
          <FilterPopover
            header={column.header}
            options={options}
            selected={selected}
            onChange={onFilter}
          />
        )}
      </div>
    </TableHead>
  );
}

function FilterPopover({
  header,
  options,
  selected,
  onChange,
}: {
  header: string;
  options: { key: string; label: string }[];
  selected: string[];
  onChange: (v: string[]) => void;
}) {
  const [search, setSearch] = useState("");
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const filteredOpts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, search]);

  const allKeysFiltered = filteredOpts.map((o) => o.key);
  const allSelected =
    filteredOpts.length > 0 && filteredOpts.every((o) => selectedSet.has(o.key));

  const toggle = (key: string) => {
    if (selectedSet.has(key)) onChange(selected.filter((k) => k !== key));
    else onChange([...selected, key]);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Filtrar ${header}`}
          className={`p-0.5 rounded hover:bg-muted ${selected.length ? "text-primary" : "text-muted-foreground/60"}`}
        >
          <Filter className="h-3 w-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="start">
        <Input
          autoFocus
          placeholder="Buscar..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 text-sm mb-2"
        />
        <div className="flex items-center justify-between px-1 pb-1.5 text-xs text-muted-foreground">
          <button
            type="button"
            className="hover:text-foreground"
            onClick={() => {
              const merged = new Set([...selected, ...allKeysFiltered]);
              onChange(Array.from(merged));
            }}
          >
            Selecionar todos
          </button>
          <button
            type="button"
            className="hover:text-foreground"
            onClick={() => {
              if (!search) onChange([]);
              else {
                const filteredSet = new Set(allKeysFiltered);
                onChange(selected.filter((k) => !filteredSet.has(k)));
              }
            }}
          >
            Desmarcar todos
          </button>
        </div>
        <div className="max-h-64 overflow-auto border-t pt-1">
          {filteredOpts.length === 0 ? (
            <div className="text-center text-xs text-muted-foreground py-4">
              Nenhum valor
            </div>
          ) : (
            <ul>
              {filteredOpts.map((o) => (
                <li key={o.key}>
                  <label className="flex items-center gap-2 px-1.5 py-1 rounded hover:bg-muted/60 cursor-pointer text-sm">
                    <Checkbox
                      checked={selectedSet.has(o.key)}
                      onCheckedChange={() => toggle(o.key)}
                    />
                    <span className="flex-1 truncate" title={o.label}>
                      {o.label}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>
        {selected.length > 0 && (
          <div className="border-t mt-1 pt-1 flex items-center justify-between text-xs">
            <span className="text-muted-foreground px-1">
              {selected.length} selecionado{selected.length === 1 ? "" : "s"}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => {
                onChange([]);
                setSearch("");
              }}
            >
              Limpar
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

function BodyRow<T>({
  row,
  columns,
  onRowClick,
  rowClassName,
}: {
  row: T;
  columns: ColumnDef<T>[];
  onRowClick?: (row: T) => void;
  rowClassName?: (row: T) => string | undefined;
}) {
  return (
    <TableRow
      className={`${onRowClick ? "cursor-pointer hover:bg-muted/40" : ""} ${rowClassName?.(row) ?? ""}`}
      onClick={onRowClick ? () => onRowClick(row) : undefined}
    >
      {columns.map((c) => {
        const alignClass =
          c.align === "right"
            ? "text-right"
            : c.align === "center"
              ? "text-center"
              : "";
        return (
          <TableCell key={c.id} className={`${alignClass} ${c.className ?? ""}`}>
            {c.render ? c.render(row) : defaultRender(c, row)}
          </TableCell>
        );
      })}
    </TableRow>
  );
}

function GroupBlock<T>({
  groupKey,
  rows,
  columns,
  groupBy,
  rowKey,
  onRowClick,
  rowClassName,
}: {
  groupKey: string;
  rows: T[];
  columns: ColumnDef<T>[];
  groupBy: NonNullable<DataTableProps<T>["groupBy"]>;
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  rowClassName?: (row: T) => string | undefined;
}) {
  return (
    <>
      {rows.map((r) => (
        <BodyRow
          key={rowKey(r)}
          row={r}
          columns={columns}
          onRowClick={onRowClick}
          rowClassName={rowClassName}
        />
      ))}
      <TableRow className="bg-muted/50 font-semibold">
        {columns.map((c, idx) => {
          const alignClass =
            c.align === "right"
              ? "text-right"
              : c.align === "center"
                ? "text-center"
                : "";
          if (idx === 0) {
            return (
              <TableCell
                key={c.id}
                className="text-muted-foreground text-xs uppercase tracking-wider"
              >
                {groupBy.label(groupKey, rows)}
              </TableCell>
            );
          }
          return (
            <TableCell key={c.id} className={`${alignClass} ${c.className ?? ""}`}>
              {c.aggregate ? c.aggregate(rows) : null}
            </TableCell>
          );
        })}
      </TableRow>
    </>
  );
}

export type { ColumnDef, DataTableProps } from "./types";
