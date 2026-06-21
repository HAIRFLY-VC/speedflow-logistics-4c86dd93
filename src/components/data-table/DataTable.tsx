import { useMemo } from "react";
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

  const filteredSorted = useMemo(() => {
    const rows = data ?? [];
    const activeFilters = Object.entries(state.filters).filter(([, v]) => v && v.trim());
    let out = rows;
    if (activeFilters.length) {
      const colById = new Map(columns.map((c) => [c.id, c]));
      out = out.filter((r) =>
        activeFilters.every(([id, term]) => {
          const c = colById.get(id);
          if (!c) return true;
          const v = c.accessor(r);
          if (v == null) return false;
          return String(v).toLowerCase().includes(term.trim().toLowerCase());
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
    ([, v]) => v && v.trim(),
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
          {activeFilterEntries.map(([id, val]) => {
            const c = columns.find((x) => x.id === id);
            return (
              <Badge key={id} variant="secondary" className="gap-1">
                <span className="text-xs">
                  {c?.header ?? id}: <span className="font-normal">{val}</span>
                </span>
                <button
                  type="button"
                  onClick={() => setFilter(id, "")}
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

      <div className="border rounded-lg overflow-hidden bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              {visibleColumns.map((c) => (
                <HeaderCell
                  key={c.id}
                  column={c}
                  sort={state.sort}
                  filterValue={state.filters[c.id] ?? ""}
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
  filterValue,
  onSort,
  onFilter,
}: {
  column: ColumnDef<T>;
  sort: { id: string; dir: "asc" | "desc" } | null;
  filterValue: string;
  onSort: () => void;
  onFilter: (v: string) => void;
}) {
  const isSorted = sort?.id === column.id;
  const alignClass =
    column.align === "right"
      ? "text-right"
      : column.align === "center"
        ? "text-center"
        : "";
  return (
    <TableHead className={`${alignClass} ${column.headerClassName ?? ""}`}>
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
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label={`Filtrar ${column.header}`}
                className={`p-0.5 rounded hover:bg-muted ${filterValue ? "text-primary" : "text-muted-foreground/60"}`}
              >
                <Filter className="h-3 w-3" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-2" align="start">
              <Input
                autoFocus
                placeholder={`Filtrar ${column.header.toLowerCase()}`}
                value={filterValue}
                onChange={(e) => onFilter(e.target.value)}
                className="h-8 text-sm"
              />
              {filterValue && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onFilter("")}
                  className="mt-1.5 h-7 w-full text-xs"
                >
                  Limpar
                </Button>
              )}
            </PopoverContent>
          </Popover>
        )}
      </div>
    </TableHead>
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
