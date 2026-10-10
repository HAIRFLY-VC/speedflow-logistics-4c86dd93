import { Check, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { CicloComercial } from "@/lib/custo-frete.query";

const diaBr = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });

/** Rótulo do ciclo comercial: out/26 (02/10 a 02/11). */
export const rotuloCiclo = (c: CicloComercial) => {
  const [a, m] = c.mes_comerc.split("-");
  const mes = new Date(Number(a), Number(m) - 1, 1).toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
  return `${mes}/${a.slice(2)} (${diaBr(c.de)} a ${diaBr(c.ate)})`;
};

type Props = {
  ciclos: CicloComercial[];
  selecionados: string[];
  onChange: (valores: string[]) => void;
  className?: string;
};

/** Seletor de ciclo(s) comercial(is) com multi-seleção. */
export function CicloMultiSelect({ ciclos, selecionados, onChange, className }: Props) {
  const resumo =
    selecionados.length === 0
      ? "Ciclo atual"
      : selecionados.length === 1
        ? rotuloCiclo(ciclos.find((c) => c.mes_comerc === selecionados[0]) ?? { mes_comerc: selecionados[0], de: "", ate: "" })
        : `${selecionados.length} ciclos`;

  function alternar(mes: string) {
    onChange(selecionados.includes(mes) ? selecionados.filter((v) => v !== mes) : [...selecionados, mes]);
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant={selecionados.length ? "secondary" : "outline"}
          size="sm"
          className={cn("h-9 max-w-[60vw] justify-between gap-1 px-3 text-sm", className)}
        >
          <span className="truncate">{resumo}</span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-0">
        <div className="flex items-center justify-between border-b px-2 py-1.5">
          <span className="text-xs font-medium">Ciclos comerciais</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            disabled={!selecionados.length}
            onClick={() => onChange([])}
          >
            Limpar
          </Button>
        </div>
        <div className="max-h-72 overflow-y-auto p-1">
          {ciclos.map((c) => {
            const ativo = selecionados.includes(c.mes_comerc);
            return (
              <button
                key={c.mes_comerc}
                type="button"
                onClick={() => alternar(c.mes_comerc)}
                className={cn(
                  "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-muted",
                  ativo && "bg-muted",
                )}
              >
                <span
                  className={cn(
                    "flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm border",
                    ativo && "border-primary bg-primary text-primary-foreground",
                  )}
                >
                  {ativo && <Check className="h-2.5 w-2.5" />}
                </span>
                <span className="flex-1 truncate">{rotuloCiclo(c)}</span>
              </button>
            );
          })}
        </div>
        <p className="border-t px-2 py-1 text-[10px] text-muted-foreground">
          Sem marcação usa o ciclo atual.
        </p>
      </PopoverContent>
    </Popover>
  );
}
