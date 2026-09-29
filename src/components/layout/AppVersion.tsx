import { useEffect, useState } from "react";

declare const __APP_VERSION__: string;
declare const __BUILD_TIME__: string;

function formatar(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

/** Versão do app + selo TESTE (pré-visualização) / OFICIAL (publicado). */
export function AppVersion() {
  const [teste, setTeste] = useState<boolean | null>(null);
  useEffect(() => {
    const h = window.location.hostname;
    setTeste(h === "localhost" || h.startsWith("id-preview--") || h.includes("-dev.lovable.app") || h.includes("lovableproject.com"));
  }, []);
  return (
    <div className="flex items-center gap-1.5 text-[10px] leading-none text-muted-foreground whitespace-nowrap">
      {teste !== null && (
        <span
          className={`rounded px-1 py-0.5 font-bold tracking-wide ${
            teste ? "bg-accent text-accent-foreground border border-border" : "bg-primary text-primary-foreground border border-primary"
          }`}
        >
          {teste ? "TESTE" : "OFICIAL"}
        </span>
      )}
      <span>v{__APP_VERSION__} · {formatar(__BUILD_TIME__)}</span>
    </div>
  );
}
