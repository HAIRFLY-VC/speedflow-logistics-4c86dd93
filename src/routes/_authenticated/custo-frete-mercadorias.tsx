import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BackButton } from "@/components/layout/BackButton";
import { exportarXlsx } from "@/components/data-table/export-xlsx";
import {
  calendarioComercialQueryOptions,
  carregarMercadorias,
  cicloAtual,
  type CicloComercial,
  type LinhaMercadoria,
} from "@/lib/custo-frete.query";

export const Route = createFileRoute("/_authenticated/custo-frete-mercadorias")({
  validateSearch: (s: Record<string, unknown>) => ({ ciclo: typeof s.ciclo === "string" ? s.ciclo : undefined }),
  head: () => ({
    meta: [
      { title: "Mercadorias faturadas — SpeedFlow Logistics" },
      { name: "description", content: "Detalhamento das notas faturadas no ciclo comercial." },
      { property: "og:title", content: "Mercadorias faturadas — SpeedFlow Logistics" },
      { property: "og:description", content: "Detalhamento das notas faturadas no ciclo comercial." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MercadoriasPage,
});

type K = keyof LinhaMercadoria;
type Col = { k: K; t: string; tipo?: "data" | "num" | "kg" };
const COLS: Col[] = [
  { k: "id_rota", t: "ID ROTA" }, { k: "cod_pedido", t: "COD_PEDIDO" }, { k: "cod_cliente", t: "COD_CLIENTE" },
  { k: "cod_vendedor", t: "COD_VENDEDOR" }, { k: "cod_filial", t: "COD_FILIAL" }, { k: "cod_agenda", t: "COD_AGENDA" },
  { k: "dt_pedido", t: "DT_PEDIDO", tipo: "data" }, { k: "status", t: "STATUS" }, { k: "dt_fatur", t: "DT_FATUR", tipo: "data" },
  { k: "entrega_agend", t: "ENTREGA_AGEND" }, { k: "bordero", t: "BORDERO" }, { k: "dt_saida", t: "DT_SAIDA", tipo: "data" },
  { k: "dt_etrg_trsp", t: "DT_ETRG_TRSP", tipo: "data" }, { k: "dt_entrega_cli", t: "DT_ENTREGA_CLI", tipo: "data" },
  { k: "dt_agendamento", t: "DT_AGENDAMENTO", tipo: "data" }, { k: "cod_transp_prn", t: "COD_TRANSP_PRN" },
  { k: "tipo_transp_pn", t: "TIPO_TRANSP_PN" }, { k: "placa_veiculo_ent", t: "PLACA_VEICULO_ENT" },
  { k: "cod_transp_ent", t: "COD_TRANSP_ENT" }, { k: "tipo_transp_ent", t: "TIPO_TRANSP_ENT" }, { k: "nro_nf", t: "NRO_NF" },
  { k: "valor", t: "VALOR", tipo: "num" }, { k: "peso", t: "PESO", tipo: "kg" }, { k: "vlr_frete", t: "VLR_FRETE", tipo: "num" },
  { k: "vlr_perna", t: "VLR_PERNA", tipo: "num" }, { k: "vlr_diaria", t: "VLR_DIARIA", tipo: "num" },
  { k: "vlr_pernoite", t: "VLR_PERNOITE", tipo: "num" }, { k: "vlr_reentrega", t: "VLR_REENTREGA", tipo: "num" },
  { k: "vlr_descarrego", t: "VLR_DESCARREGO", tipo: "num" }, { k: "tipos_ocorrencia", t: "TIPOS_OCORRENCIA" },
];

const num2 = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dataBr = (iso: string | null) => (iso ? new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString("pt-BR") : "");
const fmt = (c: Col, v: unknown) =>
  v == null || v === "" ? "" : c.tipo === "data" ? dataBr(String(v)) : c.tipo ? num2.format(Number(v)) : String(v);
const rotulo = (c: CicloComercial) => `${c.mes_comerc.slice(5, 7)}/${c.mes_comerc.slice(0, 4)} (${dataBr(c.de)} a ${dataBr(c.ate)})`;

function MercadoriasPage() {
  const { ciclo: cicloParam } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const calQ = useQuery(calendarioComercialQueryOptions());
  const ciclos = calQ.data ?? [];
  const ciclo = ciclos.find((c) => c.mes_comerc === cicloParam) ?? cicloAtual(ciclos);
  const q = useQuery({
    queryKey: ["custo-frete-mercadorias", ciclo?.mes_comerc ?? "-"],
    queryFn: () => carregarMercadorias(ciclo!),
    enabled: !!ciclo,
    staleTime: 5 * 60_000,
  });
  const [busca, setBusca] = useState("");
  const [ord, setOrd] = useState<{ k: K; asc: boolean }>({ k: "nro_nf", asc: true });

  const linhas = useMemo(() => {
    const b = busca.trim().toLowerCase();
    const f = (q.data ?? []).filter((l) => !b || COLS.some((c) => String(l[c.k] ?? "").toLowerCase().includes(b)));
    const col = COLS.find((c) => c.k === ord.k)!;
    return f.sort((a, z) => {
      const x = a[ord.k], y = z[ord.k];
      const r = col.tipo === "num" || col.tipo === "kg" ? Number(x ?? 0) - Number(y ?? 0) : String(x ?? "").localeCompare(String(y ?? ""), "pt-BR", { numeric: true });
      return ord.asc ? r : -r;
    });
  }, [q.data, busca, ord]);

  const tot = (k: K) => linhas.reduce((s, l) => s + Number(l[k] ?? 0), 0);

  const exportar = () =>
    exportarXlsx({
      fileName: `mercadorias-faturadas-${ciclo?.mes_comerc ?? ""}.xlsx`,
      headers: COLS.map((c) => c.t),
      rows: linhas.map((l) => COLS.map((c) => {
        const v = l[c.k];
        if (v == null) return null;
        if (c.tipo === "data") return dataBr(String(v));
        if (c.tipo) return Number(v);
        return String(v);
      })),
    });

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <BackButton fallbackTo="/custo-frete" fallbackLabel="Custo de Frete" className="-ml-2 mb-1" />
          <h1 className="text-2xl font-bold">Mercadorias faturadas — detalhamento</h1>
          <p className="text-sm text-muted-foreground">Notas faturadas no ciclo comercial selecionado.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input placeholder="Buscar…" value={busca} onChange={(e) => setBusca(e.target.value)} className="w-48" />
          <Select value={ciclo?.mes_comerc ?? ""} onValueChange={(v) => navigate({ search: { ciclo: v } })}>
            <SelectTrigger className="w-60"><SelectValue placeholder="Ciclo comercial" /></SelectTrigger>
            <SelectContent>
              {ciclos.slice(0, 12).map((c) => <SelectItem key={c.mes_comerc} value={c.mes_comerc}>{rotulo(c)}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={exportar} disabled={!linhas.length}>
            <Download className="mr-1 h-4 w-4" /> Excel
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {([["Notas", linhas.length.toLocaleString("pt-BR")], ["Valor", `R$ ${num2.format(tot("valor"))}`], ["Peso", `${num2.format(tot("peso"))} kg`], ["Vlr. Frete (ERP)", `R$ ${num2.format(tot("vlr_frete"))}`]] as const).map(([t, v]) => (
          <Card key={t}><CardContent className="p-3"><p className="text-xs text-muted-foreground">{t}</p><p className="text-lg font-bold tabular-nums">{q.isLoading ? "…" : v}</p></CardContent></Card>
        ))}
      </div>

      {q.isError && <p className="text-sm text-destructive">Não foi possível carregar: {(q.error as Error)?.message}</p>}

      <Card>
        <CardContent className="max-h-[70vh] overflow-auto p-0">
          <table className="w-full text-[11px]">
            <thead className="sticky top-0 z-10 bg-card text-muted-foreground">
              <tr>
                {COLS.map((c) => (
                  <th key={c.k} onClick={() => setOrd((o) => ({ k: c.k, asc: o.k === c.k ? !o.asc : true }))}
                    className={`cursor-pointer whitespace-nowrap border-b px-2 py-1.5 font-medium hover:text-foreground ${c.tipo === "num" || c.tipo === "kg" ? "text-right" : "text-left"}`}>
                    {c.t}{ord.k === c.k ? (ord.asc ? " ↑" : " ↓") : ""}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {q.isLoading && <tr><td colSpan={COLS.length} className="p-4 text-muted-foreground">Carregando…</td></tr>}
              {linhas.map((l) => (
                <tr key={`${l.nro_nf}|${l.cod_pedido}`} className="border-t hover:bg-muted/50">
                  {COLS.map((c) => (
                    <td key={c.k} className={`whitespace-nowrap px-2 py-1 ${c.tipo === "num" || c.tipo === "kg" ? "text-right tabular-nums" : ""}`}>{fmt(c, l[c.k])}</td>
                  ))}
                </tr>
              ))}
            </tbody>
            {linhas.length > 0 && (
              <tfoot className="sticky bottom-0 bg-card font-semibold">
                <tr className="border-t">
                  {COLS.map((c, i) => (
                    <td key={c.k} className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums">
                      {i === 0 ? <span className="float-left">Total</span> : c.tipo === "num" || c.tipo === "kg" ? num2.format(tot(c.k)) : ""}
                    </td>
                  ))}
                </tr>
              </tfoot>
            )}
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
