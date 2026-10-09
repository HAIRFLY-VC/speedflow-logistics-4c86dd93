import { useMemo, useState } from "react";
import { MapPin, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { normalizeArea } from "@/lib/frete-area";

type Outra = { idx: number; destino: string; municipios: string[] };

/** Consulta e manutenção dos municípios que compõem uma praça da tabela de frete. */
export function MunicipiosPracaDialog(props: {
  praca: string;
  municipios: string[];
  outras: Outra[];
  /** Nova lista desta praça e, por índice de praça, os municípios movidos dela. */
  onChange: (lista: string[], moverDe: Record<number, string[]>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [busca, setBusca] = useState("");
  const [novos, setNovos] = useState("");

  const outraDe = useMemo(() => {
    const m = new Map<string, Outra>();
    for (const o of props.outras) for (const c of o.municipios) m.set(c, o);
    return m;
  }, [props.outras]);

  const lista = [...props.municipios].sort((a, b) => a.localeCompare(b));
  const t = normalizeArea(busca);
  const filtrados = t ? lista.filter((m) => m.includes(t)) : lista;

  const candidatos = Array.from(
    new Set(novos.split(/[;,\n]+/).map(normalizeArea).filter(Boolean)),
  ).filter((m) => !props.municipios.includes(m));
  const conflitos = candidatos.filter((m) => outraDe.has(m));

  const adicionar = (mover: boolean) => {
    const aceitos = mover ? candidatos : candidatos.filter((m) => !outraDe.has(m));
    const moverDe: Record<number, string[]> = {};
    if (mover)
      for (const m of conflitos) {
        const o = outraDe.get(m)!;
        (moverDe[o.idx] ??= []).push(m);
      }
    props.onChange([...props.municipios, ...aceitos], moverDe);
    setNovos("");
  };

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-8 px-2 text-xs"
        onClick={() => setOpen(true)}
        title="Municípios da praça"
      >
        <MapPin className="h-3.5 w-3.5 mr-1" />
        {props.municipios.length}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Municípios da praça {props.praca || "(sem nome)"}</DialogTitle>
            <DialogDescription>
              {props.municipios.length} município(s). As alterações são gravadas ao salvar a tabela.
            </DialogDescription>
          </DialogHeader>

          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar município…"
            className="h-8 text-xs"
          />
          <div className="max-h-64 overflow-y-auto rounded border p-2 flex flex-wrap gap-1.5">
            {filtrados.length === 0 && (
              <span className="text-xs text-muted-foreground">Nenhum município.</span>
            )}
            {filtrados.map((m) => (
              <Badge key={m} variant="secondary" className="gap-1 text-[11px] font-normal">
                {m}
                <button
                  type="button"
                  aria-label={`Remover ${m}`}
                  onClick={() => props.onChange(props.municipios.filter((x) => x !== m), {})}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>

          <div className="space-y-2">
            <Textarea
              value={novos}
              onChange={(e) => setNovos(e.target.value)}
              placeholder="Adicionar municípios (separe por vírgula, ponto e vírgula ou um por linha)"
              className="text-xs min-h-[70px]"
            />
            {conflitos.length > 0 && (
              <div className="rounded border border-destructive/40 bg-destructive/5 p-2 text-xs space-y-1">
                <p className="font-medium">Já estão em outra praça desta tabela:</p>
                {conflitos.map((m) => (
                  <p key={m}>
                    {m} — {outraDe.get(m)!.destino}
                  </p>
                ))}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            {conflitos.length > 0 && (
              <Button type="button" variant="outline" onClick={() => adicionar(false)}>
                Adicionar só os novos
              </Button>
            )}
            <Button type="button" disabled={candidatos.length === 0} onClick={() => adicionar(true)}>
              {conflitos.length > 0 ? "Adicionar e mover para esta praça" : "Adicionar"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
