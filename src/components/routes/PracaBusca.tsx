import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const norm = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();

type Praca = { id: string; destino: string; municipios?: string[] };

export function PracaBusca(props: {
  cidade: string;
  atual: string | null;
  pracas: Praca[];
  disabled?: boolean;
  onSelect: (pracaId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const itens = useMemo(() => {
    const lista: { key: string; municipio: string | null; praca: Praca }[] = [];
    for (const p of props.pracas)
      for (const m of p.municipios ?? []) lista.push({ key: `${p.id}|${m}`, municipio: m, praca: p });
    lista.sort((a, b) => (a.municipio ?? "").localeCompare(b.municipio ?? ""));
    return lista;
  }, [props.pracas]);

  const t = norm(q);
  const municipios = t
    ? itens.filter((i) => norm(i.municipio ?? "").includes(t) || norm(i.praca.destino).includes(t)).slice(0, 50)
    : itens.slice(0, 50);
  const pracas = t ? props.pracas.filter((p) => norm(p.destino).includes(t)) : props.pracas;

  const escolher = (id: string) => {
    setOpen(false);
    props.onSelect(id);
  };

  return (
    <div onClick={(ev) => ev.stopPropagation()} className="inline-block">
      <Popover
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (o) setQ(props.cidade.split(/\s+/)[0] ?? "");
        }}
      >
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" disabled={props.disabled} className="h-7 w-52 justify-between text-[11px] font-normal">
            <span className="truncate">{props.atual ?? "Selecionar praça…"}</span>
            <ChevronDown className="h-3 w-3 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-96 p-2" align="end">
          <Input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Digite parte do município…"
            className="mb-2 h-8 text-xs"
          />
          <div className="max-h-72 overflow-y-auto text-xs">
            {municipios.length > 0 && (
              <div className="px-1 py-1 text-[10px] font-semibold uppercase text-muted-foreground">Municípios</div>
            )}
            {municipios.map((i) => (
              <button
                key={i.key}
                type="button"
                onClick={() => escolher(i.praca.id)}
                className="flex w-full items-center justify-between gap-2 rounded px-2 py-1 text-left hover:bg-accent"
              >
                <span className="truncate">{i.municipio}</span>
                <span className="shrink-0 text-muted-foreground">{i.praca.destino}</span>
              </button>
            ))}
            {pracas.length > 0 && (
              <div className="mt-1 border-t px-1 pt-2 pb-1 text-[10px] font-semibold uppercase text-muted-foreground">Praças</div>
            )}
            {pracas.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => escolher(p.id)}
                className="block w-full rounded px-2 py-1 text-left hover:bg-accent"
              >
                {p.destino}
              </button>
            ))}
            {municipios.length === 0 && pracas.length === 0 && (
              <div className="px-2 py-3 text-center text-muted-foreground">Nenhum município ou praça encontrado.</div>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
