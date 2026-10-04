import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, Loader2, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { PrintBasePrefs } from "./usePrintPrefs";
import "./print.css";

const PAPER_MM = { A4: [210, 297], Letter: [216, 279] } as const;

export type PrintOption = { key: string; label: string; checked: boolean; onChange: (v: boolean) => void };

/**
 * Módulo de impressão genérico: barra de opções (oculta na impressão),
 * pré-visualização da folha, @page com tamanho/orientação e numeração de páginas.
 */
export function PrintLayout({
  title,
  subtitle,
  prefs,
  onPrefs,
  options = [],
  extraControls,
  ready = true,
  printedBy,
  onBack,
  children,
}: {
  title: string;
  subtitle?: string;
  prefs: PrintBasePrefs;
  onPrefs: (p: Partial<PrintBasePrefs>) => void;
  options?: PrintOption[];
  extraControls?: ReactNode;
  ready?: boolean;
  printedBy?: string | null;
  onBack?: () => void;
  children: ReactNode;
}) {
  const [w, h] = PAPER_MM[prefs.paper];
  const width = prefs.orientation === "portrait" ? w : h;
  const height = prefs.orientation === "portrait" ? h : w;
  const emitido = new Date().toLocaleString("pt-BR");
  const sheetRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [paginas, setPaginas] = useState(1);

  // Estima a quantidade de páginas da pré-visualização medindo a altura do
  // conteúdo contra a área útil da folha (a numeração real por página é
  // gerada pelo navegador apenas na impressão, via @page).
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const MM_PX = 96 / 25.4;
    const utilPx = (height - 12 - 14) * MM_PX; // margens @page: 12mm topo, 14mm base
    const medir = () => {
      // Mede o conteúdo real (sem o minHeight da folha), que na impressão
      // ocupa a área útil após as margens do @page.
      const total = el.scrollHeight;
      setPaginas(Math.max(1, Math.ceil(total / utilPx)));
    };
    medir();
    const obs = new ResizeObserver(medir);
    obs.observe(el);
    return () => obs.disconnect();
  }, [height, prefs.fontSize, prefs.economico, children]);
  const rodape = `${title} · Impresso em ${emitido}${printedBy ? ` por ${printedBy}` : ""}`;
  const css = `@page { size: ${prefs.paper} ${prefs.orientation}; margin: 12mm 10mm 14mm;
    @bottom-left { content: ${JSON.stringify(rodape)}; font-size: 8px; color: #555; }
    @bottom-right { content: "Página " counter(page) " de " counter(pages); font-size: 8px; color: #555; } }`;

  return (
    <div className="min-h-screen bg-muted/40 print:bg-background">
      <style>{css}</style>
      <div className="print-hidden sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-2 text-sm">
          {onBack && (
            <Button variant="ghost" size="sm" onClick={onBack}>
              <ArrowLeft className="mr-1 h-4 w-4" /> Voltar
            </Button>
          )}
          <select
            className="h-8 rounded-md border bg-background px-2"
            value={prefs.paper}
            onChange={(e) => onPrefs({ paper: e.target.value as PrintBasePrefs["paper"] })}
            aria-label="Papel"
          >
            <option value="A4">A4</option>
            <option value="Letter">Carta</option>
          </select>
          <select
            className="h-8 rounded-md border bg-background px-2"
            value={prefs.orientation}
            onChange={(e) => onPrefs({ orientation: e.target.value as PrintBasePrefs["orientation"] })}
            aria-label="Orientação"
          >
            <option value="portrait">Retrato</option>
            <option value="landscape">Paisagem</option>
          </select>
          <select
            className="h-8 rounded-md border bg-background px-2"
            value={prefs.fontSize}
            onChange={(e) => onPrefs({ fontSize: e.target.value as PrintBasePrefs["fontSize"] })}
            aria-label="Fonte"
          >
            <option value="sm">Fonte pequena</option>
            <option value="md">Fonte normal</option>
            <option value="lg">Fonte grande</option>
          </select>
          <label className="flex items-center gap-1.5">
            <Switch checked={prefs.economico} onCheckedChange={(v) => onPrefs({ economico: v })} />
            Econômico
          </label>
          {extraControls}
          <div className="ml-auto">
            <Button size="sm" disabled={!ready} onClick={() => window.print()}>
              {ready ? <Printer className="mr-1 h-4 w-4" /> : <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              Imprimir / Salvar PDF
            </Button>
          </div>
        </div>
        {options.length > 0 && (
          <div className="mx-auto flex max-w-6xl flex-wrap gap-x-4 gap-y-1 px-4 pb-2 text-xs">
            <span className="font-medium text-muted-foreground">Incluir:</span>
            {options.map((o) => (
              <div key={o.key} className="flex items-center gap-1.5">
                <Switch id={`opt-${o.key}`} checked={o.checked} onCheckedChange={o.onChange} />
                <Label htmlFor={`opt-${o.key}`} className="text-xs font-normal">{o.label}</Label>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="py-6 print:py-0">
        <div
          ref={sheetRef}
          className="print-sheet"
          data-font={prefs.fontSize}
          data-eco={prefs.economico ? "true" : "false"}
          style={{ width: `${width}mm`, minHeight: `${height}mm` }}
        >
          <div ref={contentRef}>
          <header className="print-band mb-3 flex items-end justify-between border-b-2 border-foreground pb-2">
            <div>
              <div className="text-[0.85em] font-semibold uppercase tracking-wide text-muted-foreground">SpeedFlow Logistics</div>
              <h1 className="text-[1.6em] font-bold leading-tight">{title}</h1>
              {subtitle && <div className="text-muted-foreground">{subtitle}</div>}
            </div>
            <div className="text-right text-[0.85em] text-muted-foreground">
              <div>Emitido em {emitido}</div>
              {printedBy && <div>por {printedBy}</div>}
            </div>
          </header>
          {children}
          <footer
            className="print-preview-page-number"
            aria-label={`Pré-visualização com aproximadamente ${paginas} página(s)`}
          >
            Página 1 de {paginas}
          </footer>
          </div>
        </div>
      </div>
    </div>
  );
}
