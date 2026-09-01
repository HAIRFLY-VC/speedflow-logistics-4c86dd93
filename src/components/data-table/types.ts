import type { ReactNode } from "react";

export type ColumnDef<T> = {
  id: string;
  header: string;
  /** Returns the raw value used for sorting and as the canonical filter key. */
  accessor: (row: T) => unknown;
  /** Custom cell renderer. Falls back to String(accessor(row)). */
  render?: (row: T) => ReactNode;
  /** Optional human-readable label used in the filter list. Defaults to formatting the accessor. */
  filterLabel?: (row: T) => string;
  /** Optional content type hint for ordering distinct filter values. */
  filterType?: "text" | "number" | "date";
  /** Aggregation cell used inside the group footer when groupBy is set. */
  aggregate?: (rows: T[]) => ReactNode;
  defaultVisible?: boolean;
  align?: "left" | "right" | "center";
  className?: string;
  headerClassName?: string;
  sortable?: boolean;
  filterable?: boolean;
  /** Keeps the column at the very beginning, ignoring saved column order. */
  pinFirst?: boolean;
  /** Keeps the column immediately after the given column id, ignoring saved order. */
  pinAfter?: string;

  /** Hides the column from the mobile card layout (still shown in the table). */
  hideOnCard?: boolean;

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
  onFilteredChange?: (rows: T[]) => void;
  /** When true, the table body becomes scrollable within a fixed height with the header sticky. */
  scrollable?: boolean;
  /** Optional action rendered at the top-right corner of each mobile card. */
  cardHeaderAction?: (row: T) => ReactNode;

  groupBy?: {
    id: string;
    accessor: (row: T) => string;
    label: (key: string, rows: T[]) => ReactNode;
  };
};
