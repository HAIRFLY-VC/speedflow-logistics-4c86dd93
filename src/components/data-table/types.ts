import type { ReactNode } from "react";

export type ColumnDef<T> = {
  id: string;
  header: string;
  /** Returns the raw value used for sorting and filtering (case-insensitive contains). */
  accessor: (row: T) => unknown;
  /** Custom cell renderer. Falls back to String(accessor(row)). */
  render?: (row: T) => ReactNode;
  /** Aggregation cell used inside the group footer when groupBy is set. */
  aggregate?: (rows: T[]) => ReactNode;
  defaultVisible?: boolean;
  align?: "left" | "right" | "center";
  className?: string;
  headerClassName?: string;
  sortable?: boolean;
  filterable?: boolean;
  width?: string;
};

export type SortState = { id: string; dir: "asc" | "desc" } | null;

export type DataTableProps<T> = {
  tableKey: string;
  columns: ColumnDef<T>[];
  data: T[] | undefined;
  isLoading?: boolean;
  emptyMessage?: string;
  defaultSort?: SortState;
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  rowClassName?: (row: T) => string | undefined;
  toolbarLeft?: ReactNode;
  toolbarRight?: ReactNode;
  groupBy?: {
    id: string;
    accessor: (row: T) => string;
    label: (key: string, rows: T[]) => ReactNode;
  };
};
