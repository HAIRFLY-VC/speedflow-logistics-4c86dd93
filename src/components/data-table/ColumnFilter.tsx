import { useMemo, useState } from "react";
import { ArrowDownAZ, ArrowUpAZ, Check, Filter, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  filtroAtivo,
  type ColumnFilter as Filtro,
  type ColunaTipo,
  type DateOp,
  type NumberOp,
  type TextOp,
} from "./column-filters";

export type OpcaoColuna = { valor: string; qtd: number };

type Props = {
  label: string;
  tipo: ColunaTipo;
  opcoes: OpcaoColuna[];
  filtro: Filtro | undefined;
  onChange: (f: Filtro | undefined) => void;
  ordem?: "asc" | "desc" | null;
  onOrdenar?: (dir: "asc" | "desc") => void;
};

const TEXT_OPS: { v: TextOp; l: string }[] = [
  { v: "contains", l: "Contém" },
  { v: "notContains", l: "Não contém" },
  { v: "startsWith", l: "Começa com" },
  { v: "equals", l: "Igual a" },
];
const NUM_OPS: { v: NumberOp; l: string }[] = [
  { v: "eq", l: "Igual a" },
  { v: "neq", l: "Diferente de" },
  { v: "gt", l: "Maior que" },
  { v: "gte", l: "Maior ou igual a" },
  { v: "lt", l: "Menor que" },
  { v: "lte", l: "Menor ou igual a" },
  { v: "between", l: "Entre" },
];
const DATE_OPS: { v: DateOp; l: string }[] = [
  { v: "eq", l: "Igual a" },
  { v: "before", l: "Antes de" },
  { v: "after", l: "Depois de" },
  { v: "between", l: "Entre" },
  { v: "empty", l: "Vazio" },
];

/** Filtro de coluna no estilo Excel, com opções conforme o tipo do dado. */
export function ColumnFilter({
  label,
  tipo,
  opcoes,
  filtro,
  onChange,
  ordem,
  onOrdenar,
}: Props) {
  const [busca, setBusca] = useState("");
  const ativo = filtroAtivo(filtro);

  const textoFiltro = filtro?.type === "text" ? filtro : undefined;
  const numFiltro = filtro?.type === "number" ? filtro : undefined;
  const dataFiltro = filtro?.type === "date" ? filtro : undefined;
  const selecionados = textoFiltro?.values ?? [];

  const visiveis = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return t ? opcoes.filter((o) => o.valor.toLowerCase().includes(t)) : opcoes;
  }, [opcoes, busca]);

  function alternar(valor: string) {
    const atuais = selecionados;
    const novos = atuais.includes(valor)
      ? atuais.filter((v) => v !== valor)
      : [...atuais, valor];
    onChange({ ...(textoFiltro ?? { type: "text" as const }), type: "text", values: novos });
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Filtrar ${label}`}
          className={cn(
            "inline-flex items-center gap-1 rounded px-1 py-0.5 text-xs font-medium hover:bg-muted",
            ativo && "text-primary",
          )}
        >
          <span className="whitespace-nowrap">{label}</span>
          <Filter className={cn("h-3 w-3 opacity-50", ativo && "fill-current opacity-100")} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-0 text-xs">
        <div className="flex items-center justify-between border-b px-2 py-1.5">
          <span className="font-medium">{label}</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            disabled={!ativo}
            onClick={() => onChange(undefined)}
          >
            Limpar
          </Button>
        </div>

        {onOrdenar && (
          <div className="flex gap-1 border-b p-1.5">
            <Button
              variant={ordem === "asc" ? "secondary" : "ghost"}
              size="sm"
              className="h-7 flex-1 gap-1 text-xs"
              onClick={() => onOrdenar("asc")}
            >
              <ArrowUpAZ className="h-3.5 w-3.5" /> Crescente
            </Button>
            <Button
              variant={ordem === "desc" ? "secondary" : "ghost"}
              size="sm"
              className="h-7 flex-1 gap-1 text-xs"
              onClick={() => onOrdenar("desc")}
            >
              <ArrowDownAZ className="h-3.5 w-3.5" /> Decrescente
            </Button>
          </div>
        )}

        {tipo === "text" && (
          <>
            <div className="space-y-1.5 border-b p-1.5">
              <Select
                value={textoFiltro?.op ?? ""}
                onValueChange={(v) =>
                  onChange({
                    ...(textoFiltro ?? { type: "text" as const }),
                    type: "text",
                    op: v as TextOp,
                  })
                }
              >
                <SelectTrigger className="h-7 text-xs">
                  <SelectValue placeholder="Condição de texto" />
                </SelectTrigger>
                <SelectContent>
                  {TEXT_OPS.map((o) => (
                    <SelectItem key={o.v} value={o.v} className="text-xs">
                      {o.l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                className="h-7 text-xs"
                placeholder="Valor"
                value={textoFiltro?.value ?? ""}
                onChange={(e) =>
                  onChange({
                    ...(textoFiltro ?? { type: "text" as const }),
                    type: "text",
                    op: textoFiltro?.op ?? "contains",
                    value: e.target.value,
                  })
                }
              />
            </div>

            <div className="relative border-b p-1.5">
              <Search className="absolute left-3 top-3.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                className="h-7 pl-7 text-xs"
                placeholder="Pesquisar valores"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
            </div>

            <div className="flex items-center justify-between border-b px-2 py-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-1 text-xs"
                onClick={() =>
                  onChange({
                    ...(textoFiltro ?? { type: "text" as const }),
                    type: "text",
                    values: visiveis.map((o) => o.valor),
                  })
                }
              >
                Selecionar tudo
              </Button>
              <span className="text-[10px] text-muted-foreground">
                {selecionados.length ? `${selecionados.length} selecionados` : "todos"}
              </span>
            </div>

            <div className="max-h-56 overflow-y-auto p-1">
              {visiveis.length === 0 && (
                <p className="p-2 text-muted-foreground">Nenhum valor</p>
              )}
              {visiveis.map((o) => {
                const marcado = selecionados.includes(o.valor);
                return (
                  <button
                    key={o.valor}
                    type="button"
                    onClick={() => alternar(o.valor)}
                    className="flex w-full items-center gap-2 rounded px-2 py-1 text-left hover:bg-muted"
                  >
                    <span
                      className={cn(
                        "flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm border",
                        marcado && "border-primary bg-primary text-primary-foreground",
                      )}
                    >
                      {marcado && <Check className="h-2.5 w-2.5" />}
                    </span>
                    <span className="flex-1 truncate">{o.valor}</span>
                    <span className="text-[10px] text-muted-foreground">{o.qtd}</span>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {tipo === "number" && (
          <div className="space-y-1.5 p-1.5">
            <Select
              value={numFiltro?.op ?? ""}
              onValueChange={(v) =>
                onChange({ ...(numFiltro ?? {}), type: "number", op: v as NumberOp })
              }
            >
              <SelectTrigger className="h-7 text-xs">
                <SelectValue placeholder="Condição numérica" />
              </SelectTrigger>
              <SelectContent>
                {NUM_OPS.map((o) => (
                  <SelectItem key={o.v} value={o.v} className="text-xs">
                    {o.l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex gap-1.5">
              <Input
                type="number"
                className="h-7 text-xs"
                placeholder="Valor"
                value={numFiltro?.value ?? ""}
                onChange={(e) =>
                  onChange({
                    ...(numFiltro ?? {}),
                    type: "number",
                    op: numFiltro?.op ?? "gte",
                    value: e.target.value === "" ? null : Number(e.target.value),
                  })
                }
              />
              {numFiltro?.op === "between" && (
                <Input
                  type="number"
                  className="h-7 text-xs"
                  placeholder="até"
                  value={numFiltro?.value2 ?? ""}
                  onChange={(e) =>
                    onChange({
                      ...(numFiltro ?? {}),
                      type: "number",
                      op: "between",
                      value2: e.target.value === "" ? null : Number(e.target.value),
                    })
                  }
                />
              )}
            </div>
          </div>
        )}

        {tipo === "date" && (
          <div className="space-y-1.5 p-1.5">
            <Select
              value={dataFiltro?.op ?? ""}
              onValueChange={(v) =>
                onChange({ ...(dataFiltro ?? {}), type: "date", op: v as DateOp })
              }
            >
              <SelectTrigger className="h-7 text-xs">
                <SelectValue placeholder="Condição de data" />
              </SelectTrigger>
              <SelectContent>
                {DATE_OPS.map((o) => (
                  <SelectItem key={o.v} value={o.v} className="text-xs">
                    {o.l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {dataFiltro?.op !== "empty" && (
              <div className="flex gap-1.5">
                <Input
                  type="date"
                  className="h-7 text-xs"
                  value={dataFiltro?.value ?? ""}
                  onChange={(e) =>
                    onChange({
                      ...(dataFiltro ?? {}),
                      type: "date",
                      op: dataFiltro?.op ?? "eq",
                      value: e.target.value || null,
                    })
                  }
                />
                {dataFiltro?.op === "between" && (
                  <Input
                    type="date"
                    className="h-7 text-xs"
                    value={dataFiltro?.value2 ?? ""}
                    onChange={(e) =>
                      onChange({
                        ...(dataFiltro ?? {}),
                        type: "date",
                        op: "between",
                        value2: e.target.value || null,
                      })
                    }
                  />
                )}
              </div>
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
