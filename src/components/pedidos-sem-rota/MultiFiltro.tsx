import { useMemo, useState } from "react";
import { ArrowDownAZ, Check, ChevronDown, Ruler } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type OpcaoFiltro = {
  valor: string;
  qtd: number;
  peso: number;
  valorTotal: number;
  /** Distância em km até o depósito (menor distância do grupo), quando disponível. */
  distanciaKm?: number | null;
};

type Props = {
  label: string;
  opcoes: OpcaoFiltro[];
  selecionados: string[];
  onChange: (valores: string[]) => void;
  /** Quando true, exibe o alternador de ordenação A–Z / distância. */
  permiteOrdenarDistancia?: boolean;
};

const fmtBrl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const fmtKm = (v: number) =>
  `${v.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} km`;

/** Filtro compacto de múltipla seleção, pensado para uso no celular. */
export function MultiFiltro({
  label,
  opcoes,
  selecionados,
  onChange,
  permiteOrdenarDistancia = false,
}: Props) {
  const [ordenacao, setOrdenacao] = useState<"az" | "distancia">("az");

  const resumo =
    selecionados.length === 0
      ? label
      : selecionados.length === 1
        ? selecionados[0]
        : `${label} (${selecionados.length})`;

  const opcoesOrdenadas = useMemo(() => {
    if (!permiteOrdenarDistancia || ordenacao === "az") return opcoes;
    return [...opcoes].sort(
      (a, b) =>
        (a.distanciaKm ?? Number.POSITIVE_INFINITY) -
          (b.distanciaKm ?? Number.POSITIVE_INFINITY) ||
        a.valor.localeCompare(b.valor),
    );
  }, [opcoes, ordenacao, permiteOrdenarDistancia]);

  function alternar(valor: string) {
    onChange(
      selecionados.includes(valor)
        ? selecionados.filter((v) => v !== valor)
        : [...selecionados, valor],
    );
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant={selecionados.length ? "secondary" : "outline"}
          size="sm"
          className="h-8 max-w-[46vw] justify-between gap-1 px-2 text-xs"
        >
          <span className="truncate">{resumo}</span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-0">
        <div className="flex items-center justify-between gap-1 border-b px-2 py-1.5">
          <span className="text-xs font-medium">{label}</span>
          <div className="flex items-center gap-1">
            {permiteOrdenarDistancia && (
              <div className="flex overflow-hidden rounded border text-[10px]">
                <button
                  type="button"
                  title="Ordenar pela descrição (A–Z)"
                  onClick={() => setOrdenacao("az")}
                  className={cn(
                    "flex items-center gap-0.5 px-1.5 py-0.5",
                    ordenacao === "az"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted",
                  )}
                >
                  <ArrowDownAZ className="h-3 w-3" />
                  A–Z
                </button>
                <button
                  type="button"
                  title="Ordenar pela distância do depósito"
                  onClick={() => setOrdenacao("distancia")}
                  className={cn(
                    "flex items-center gap-0.5 px-1.5 py-0.5",
                    ordenacao === "distancia"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted",
                  )}
                >
                  <Ruler className="h-3 w-3" />
                  km
                </button>
              </div>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={() => onChange([])}
              disabled={!selecionados.length}
            >
              Limpar
            </Button>
          </div>
        </div>
        <div className="max-h-64 overflow-y-auto overscroll-contain p-1">
          {opcoesOrdenadas.length === 0 && (
            <p className="px-2 py-3 text-xs text-muted-foreground">Nada a filtrar</p>
          )}
          {opcoesOrdenadas.map((o) => {
            const ativo = selecionados.includes(o.valor);
            return (
              <button
                key={o.valor}
                type="button"
                onClick={() => alternar(o.valor)}
                className={cn(
                  "flex w-full flex-col gap-0.5 rounded px-2 py-1.5 text-left text-xs hover:bg-muted",
                  ativo && "bg-muted",
                )}
              >
                <div className="flex items-center gap-2">
                  <Check
                    className={cn("h-3.5 w-3.5 shrink-0", ativo ? "opacity-100" : "opacity-0")}
                  />
                  <span className={cn("truncate", ativo && "font-medium")}>{o.valor}</span>
                  {permiteOrdenarDistancia && o.distanciaKm != null && (
                    <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">
                      {fmtKm(o.distanciaKm)}
                    </span>
                  )}
                </div>
                <div className="pl-5 text-[10px] text-muted-foreground">
                  {o.qtd} ped · {o.peso.toFixed(0)} kg · {fmtBrl(o.valorTotal)}
                </div>
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
