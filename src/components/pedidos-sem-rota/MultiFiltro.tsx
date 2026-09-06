import { Check, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

type Props = {
  label: string;
  opcoes: string[];
  selecionados: string[];
  onChange: (valores: string[]) => void;
};

/** Filtro compacto de múltipla seleção, pensado para uso no celular. */
export function MultiFiltro({ label, opcoes, selecionados, onChange }: Props) {
  const resumo =
    selecionados.length === 0
      ? label
      : selecionados.length === 1
        ? selecionados[0]
        : `${label} (${selecionados.length})`;

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
      <PopoverContent align="start" className="w-56 p-0">
        <div className="flex items-center justify-between border-b px-2 py-1.5">
          <span className="text-xs font-medium">{label}</span>
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
        <ScrollArea className="max-h-64">
          <div className="p-1">
            {opcoes.length === 0 && (
              <p className="px-2 py-3 text-xs text-muted-foreground">Nada a filtrar</p>
            )}
            {opcoes.map((o) => {
              const ativo = selecionados.includes(o);
              return (
                <button
                  key={o}
                  type="button"
                  onClick={() => alternar(o)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-muted",
                    ativo && "font-medium",
                  )}
                >
                  <Check className={cn("h-3.5 w-3.5", ativo ? "opacity-100" : "opacity-0")} />
                  <span className="truncate">{o}</span>
                </button>
              );
            })}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
