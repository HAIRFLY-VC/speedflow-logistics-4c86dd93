export type TextOp = "contains" | "notContains" | "startsWith" | "equals";
export type NumberOp = "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "between";
export type DateOp = "eq" | "before" | "after" | "between" | "empty";

export type TextFilter = {
  type: "text";
  values?: string[];
  op?: TextOp;
  value?: string;
};
export type NumberFilter = {
  type: "number";
  op?: NumberOp;
  value?: number | null;
  value2?: number | null;
};
export type DateFilter = {
  type: "date";
  op?: DateOp;
  value?: string | null;
  value2?: string | null;
};

export type ColumnFilter = TextFilter | NumberFilter | DateFilter;
export type ColumnFilters = Record<string, ColumnFilter>;
export type ColunaTipo = "text" | "number" | "date";

export function filtroAtivo(f: ColumnFilter | undefined): boolean {
  if (!f) return false;
  if (f.type === "text") {
    return Boolean((f.values && f.values.length) || (f.op && f.value?.trim()));
  }
  if (f.type === "number") {
    if (!f.op) return false;
    if (f.op === "between") return f.value != null && f.value2 != null;
    return f.value != null;
  }
  if (!f.op) return false;
  if (f.op === "empty") return true;
  if (f.op === "between") return Boolean(f.value && f.value2);
  return Boolean(f.value);
}

export function contarFiltros(filtros: ColumnFilters): number {
  return Object.values(filtros).filter(filtroAtivo).length;
}

/** raw: string exibida (text), número (number) ou "YYYY-MM-DD" (date). */
export function combinaFiltro(
  f: ColumnFilter | undefined,
  raw: string | number | null,
): boolean {
  if (!filtroAtivo(f) || !f) return true;

  if (f.type === "text") {
    const texto = raw == null ? "(vazio)" : String(raw);
    if (f.values && f.values.length && !f.values.includes(texto)) return false;
    if (f.op && f.value?.trim()) {
      const a = texto.toLowerCase();
      const b = f.value.trim().toLowerCase();
      if (f.op === "contains" && !a.includes(b)) return false;
      if (f.op === "notContains" && a.includes(b)) return false;
      if (f.op === "startsWith" && !a.startsWith(b)) return false;
      if (f.op === "equals" && a !== b) return false;
    }
    return true;
  }

  if (f.type === "number") {
    const n = raw == null || raw === "" ? null : Number(raw);
    if (n == null || Number.isNaN(n)) return false;
    const v = Number(f.value);
    switch (f.op) {
      case "eq":
        return n === v;
      case "neq":
        return n !== v;
      case "gt":
        return n > v;
      case "gte":
        return n >= v;
      case "lt":
        return n < v;
      case "lte":
        return n <= v;
      case "between":
        return n >= v && n <= Number(f.value2);
      default:
        return true;
    }
  }

  const d = raw == null || raw === "" ? null : String(raw).slice(0, 10);
  if (f.op === "empty") return d == null;
  if (d == null) return false;
  switch (f.op) {
    case "eq":
      return d === f.value;
    case "before":
      return d < String(f.value);
    case "after":
      return d > String(f.value);
    case "between":
      return d >= String(f.value) && d <= String(f.value2);
    default:
      return true;
  }
}
