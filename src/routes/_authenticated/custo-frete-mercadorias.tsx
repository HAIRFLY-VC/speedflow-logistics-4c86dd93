import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Download, RotateCcw } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BackButton } from "@/components/layout/BackButton";
import { CicloMultiSelect } from "@/components/custo-frete/CicloMultiSelect";
import { useServerFn } from "@tanstack/react-start";
import { listarProvisoesNotas } from "@/lib/provisao-frete.functions";
import { exportarXlsx } from "@/components/data-table/export-xlsx";
import { ColumnFilter, type OpcaoColuna } from "@/components/data-table/ColumnFilter";
import { combinaFiltro, contarFiltros, type ColunaTipo } from "@/components/data-table/column-filters";
import { useColumnFilterPrefs } from "@/components/data-table/useColumnFilterPrefs";
import {
  calendarioComercialQueryOptions,
  carregarMercadorias,
  aplicarProvisoes,
  consolidarReentregas,
  cicloAtual,
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
  { k: "id_rota", t: "ID ROTA" }, { k: "cod_pedido", t: "COD_PEDIDO" }, { k: "cod_cliente", t: "COD_CLIENTE" }, { k: "uf", t: "UF" },
  { k: "cod_vendedor", t: "COD_VENDEDOR" }, { k: "cod_filial", t: "COD_FILIAL" }, { k: "cod_agenda", t: "COD_AGENDA" },
  { k: "dt_pedido", t: "DT_PEDIDO", tipo: "data" }, { k: "status", t: "STATUS" }, { k: "dt_fatur", t: "DT_FATUR", tipo: "data" },
  { k: "entrega_agend", t: "ENTREGA_AGEND" }, { k: "bordero", t: "BORDERO" }, { k: "dt_saida", t: "DT_SAIDA", tipo: "data" },
  { k: "dt_etrg_trsp", t: "DT_ETRG_TRSP", tipo: "data" }, { k: "dt_entrega_cli", t: "DT_ENTREGA_CLI", tipo: "data" },
  { k: "dt_agendamento", t: "DT_AGENDAMENTO", tipo: "data" }, { k: "cod_transp_prn", t: "COD_TRANSP_PRN" },
  { k: "tipo_transp_pn", t: "TIPO_TRANSP_PN" }, { k: "placa_veiculo_ent", t: "PLACA_VEICULO_ENT" },
  { k: "cod_transp_ent", t: "COD_TRANSP_ENT" }, { k: "tipo_transp_ent", t: "TIPO_TRANSP_ENT" }, { k: "nro_nf", t: "NRO_NF" },
  { k: "valor", t: "VALOR", tipo: "num" }, { k: "peso", t: "PESO", tipo: "kg" }, { k: "vlr_frete", t: "VLR_FRETE", tipo: "num" }, { k: "origem_frete", t: "ORIGEM_FRETE" },
  { k: "vlr_perna", t: "VLR_PERNA", tipo: "num" }, { k: "vlr_diaria", t: "VLR_DIARIA", tipo: "num" },
  { k: "vlr_pernoite", t: "VLR_PERNOITE", tipo: "num" }, { k: "vlr_reentrega", t: "VLR_REENTREGA", tipo: "num" },
  { k: "vlr_descarrego", t: "VLR_DESCARREGO", tipo: "num" }, { k: "tipos_ocorrencia", t: "TIPOS_OCORRENCIA" },
];

const num2 = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dataBr = (iso: string | null) => (iso ? new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString("pt-BR") : "");
const fmt = (c: Col, v: unknown) =>
  v == null || v === "" ? "" : c.tipo === "data" ? dataBr(String(v)) : c.tipo ? num2.format(Number(v)) : String(v);
const tipoFiltro = (c: Col): ColunaTipo => (c.tipo === "data" ? "date" : c.tipo ? "number" : "text");
const valorFiltro = (c: Col, l: LinhaMercadoria): string | number | null => {
  const v = l[c.k];
  if (v == null || v === "") return null;
  if (c.tipo === "data") return String(v).slice(0, 10);
  if (c.tipo) return Number(v);
  return String(v);
};

function MercadoriasPage() {
  const listarProvisoes = useServerFn(listarProvisoesNotas);
  const { ciclo: cicloParam } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const calQ = useQuery(calendarioComercialQueryOptions());
  const ciclos = calQ.data ?? [];
  const pedidoCiclos = (cicloParam ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const cicloAtualC = cicloAtual(ciclos);
  const marcados = ciclos.filter((c) => pedidoCiclos.includes(c.mes_comerc));
  const ciclosSel = marcados.length ? marcados : cicloAtualC ? [cicloAtualC] : [];
  const q = useQuery({
    queryKey: ["custo-frete-mercadorias", "multi", ciclosSel.map((c) => c.mes_comerc).join(",")],
    queryFn: async () => {
      let aviso: string | null = null;
      // Ciclos carregados em paralelo (cada ciclo fica em cache por 5 min).
      const partes = await Promise.all(
        ciclosSel.map(async (c) => {
          const base = await carregarMercadorias(c);
          const semFrete = base.filter((l) => l.origem_frete !== "R").map((l) => l.nro_nf);
          if (!semFrete.length) return base;
          try {
            const provs = await listarProvisoes({ data: { nfs: semFrete } });
            return aplicarProvisoes(base, provs);
          } catch (e) {
            console.warn("Provisões indisponíveis", e);
            aviso = "Valores provisionados indisponíveis no momento; exibindo apenas frete real.";
            return base;
          }
        }),
      );
      const todas: LinhaMercadoria[] = partes.flat();
      return { linhas: consolidarReentregas(todas), avisoProv: aviso };
    },
    enabled: ciclosSel.length > 0,
    staleTime: 5 * 60_000,
  });
  const [busca, setBusca] = useState("");
  const prefs = useColumnFilterPrefs("custo-frete-mercadorias", { id: "nro_nf", dir: "asc" });
  const { filtros, setFiltro, limparFiltros } = prefs;
  const ordK = (COLS.find((c) => c.k === prefs.sort?.id)?.k ?? "nro_nf") as K;
  const ord = { k: ordK, asc: prefs.sort?.dir !== "desc" };
  const setOrd = (fn: (o: { k: K; asc: boolean }) => { k: K; asc: boolean }) => {
    const n = fn(ord);
    prefs.setSort({ id: n.k, dir: n.asc ? "asc" : "desc" });
  };
  const nFiltros = contarFiltros(filtros);

  const baseBusca = useMemo(() => {
    const b = busca.trim().toLowerCase();
    return (q.data?.linhas ?? []).filter((l) => !b || COLS.some((c) => String(l[c.k] ?? "").toLowerCase().includes(b)));
  }, [q.data, busca]);

  const passa = (l: LinhaMercadoria, exceto?: K) =>
    COLS.every((c) => c.k === exceto || combinaFiltro(filtros[c.k], valorFiltro(c, l)));

  const opcoes = useMemo(() => {
    const m: Partial<Record<K, OpcaoColuna[]>> = {};
    for (const c of COLS) {
      if (tipoFiltro(c) !== "text") continue;
      const cont = new Map<string, number>();
      for (const l of baseBusca) {
        if (!passa(l, c.k)) continue;
        const v = valorFiltro(c, l);
        const t = v == null ? "(vazio)" : String(v);
        cont.set(t, (cont.get(t) ?? 0) + 1);
      }
      m[c.k] = [...cont].map(([valor, qtd]) => ({ valor, qtd })).sort((a, b) => a.valor.localeCompare(b.valor, "pt-BR", { numeric: true }));
    }
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseBusca, filtros]);

  const linhas = useMemo(() => {
    const f = baseBusca.filter((l) => passa(l));
    const col = COLS.find((c) => c.k === ord.k)!;
    return f.sort((a, z) => {
      const x = a[ord.k], y = z[ord.k];
      const r = col.tipo === "num" || col.tipo === "kg" ? Number(x ?? 0) - Number(y ?? 0) : String(x ?? "").localeCompare(String(y ?? ""), "pt-BR", { numeric: true });
      return ord.asc ? r : -r;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseBusca, filtros, ord.k, ord.asc]);

  const tot = (k: K) => linhas.reduce((s, l) => s + Number(l[k] ?? 0), 0);
  const totOrig = (o: "R" | "P") => linhas.reduce((s, l) => s + (l.origem_frete === o ? Number(l.vlr_frete ?? 0) : 0), 0);
  const pctFrete = tot("valor") > 0 ? (tot("vlr_frete") / tot("valor")) * 100 : null;

  const exportar = () =>
    exportarXlsx({
      fileName: `mercadorias-faturadas-${ciclosSel.map((c) => c.mes_comerc).join("-") || "atual"}.xlsx`,
      headers: [...COLS.map((c) => c.t), "REENTREGA"],
      rows: linhas.map((l) => COLS.map((c) => {
        const v = l[c.k];
        if (v == null) return null;
        if (c.tipo === "data") return dataBr(String(v));
        if (c.tipo) return Number(v);
        return String(v);
      }).concat(l.reentrega ? `S (borderôs ${l.reentrega.borderos.join(", ")})` : "N")),
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
          {nFiltros > 0 && (
            <Button variant="ghost" size="sm" onClick={limparFiltros}>Limpar filtros ({nFiltros})</Button>
          )}
          <CicloMultiSelect
            ciclos={ciclos.slice(0, 12)}
            selecionados={marcados.map((c) => c.mes_comerc)}
            onChange={(v) => navigate({ search: { ciclo: v.length ? v.join(",") : undefined } })}
          />
          <Button variant="outline" size="sm" onClick={exportar} disabled={!linhas.length}>
            <Download className="mr-1 h-4 w-4" /> Excel
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {([["Notas", linhas.length.toLocaleString("pt-BR")], ["Valor", `R$ ${num2.format(tot("valor"))}`], ["Peso", `${num2.format(tot("peso"))} kg`], ["Vlr. Frete", `R$ ${num2.format(tot("vlr_frete"))}`]] as const).map(([t, v]) => (
          <Card key={t}><CardContent className="p-3">
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs text-muted-foreground">{t}</p>
              {t === "Vlr. Frete" && <p className="text-lg font-bold leading-none tabular-nums">{q.isLoading ? "…" : pctFrete == null ? "—" : `${pctFrete.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`}</p>}
            </div>
            <p className="text-lg font-bold tabular-nums">{q.isLoading ? "…" : v}</p>
            {t === "Vlr. Frete" && !q.isLoading && <p className="text-[11px] text-muted-foreground tabular-nums">Real R$ {num2.format(totOrig("R"))} / Provisionado R$ {num2.format(totOrig("P"))}</p>}
          </CardContent></Card>
        ))}
      </div>

      {q.data?.avisoProv && <p className="text-xs text-muted-foreground">{q.data.avisoProv}</p>}
      {q.isError && <p className="text-sm text-destructive">Não foi possível carregar: {(q.error as Error)?.message}</p>}

      <TooltipProvider delayDuration={150}>
      <Card>
        <CardContent className="max-h-[70vh] overflow-auto p-0">
          <table className="w-full text-[11px]">
            <thead className="sticky top-0 z-10 bg-card text-muted-foreground">
              <tr>
                {COLS.map((c) => (
                  <th key={c.k}
                    className={`whitespace-nowrap border-b px-1 py-1 font-medium ${c.tipo === "num" || c.tipo === "kg" ? "text-right" : "text-left"}`}>
                    <span className="inline-flex items-center">
                      <ColumnFilter
                        label={c.t}
                        tipo={tipoFiltro(c)}
                        opcoes={opcoes[c.k] ?? []}
                        filtro={filtros[c.k]}
                        onChange={(f) => setFiltro(c.k, f)}
                        ordem={ord.k === c.k ? (ord.asc ? "asc" : "desc") : null}
                        onOrdenar={(d) => setOrd(() => ({ k: c.k, asc: d === "asc" }))}
                      />
                      <button type="button" className="px-0.5 hover:text-foreground" aria-label={`Ordenar ${c.t}`}
                        onClick={() => setOrd((o) => ({ k: c.k, asc: o.k === c.k ? !o.asc : true }))}>
                        {ord.k === c.k ? (ord.asc ? "↑" : "↓") : "↕"}
                      </button>
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {q.isLoading && <tr><td colSpan={COLS.length} className="p-4 text-muted-foreground">Carregando…</td></tr>}
              {linhas.map((l) => (
                <tr key={l.cod_pedido} className={`border-t ${l.reentrega ? "bg-warning/15 hover:bg-warning/25" : "hover:bg-muted/50"}`}>
                  {COLS.map((c) => (
                    <td key={c.k} className={`whitespace-nowrap px-2 py-1 ${c.tipo === "num" || c.tipo === "kg" ? "text-right tabular-nums" : ""}`}>
                      {c.k === "cod_pedido" && l.reentrega ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="inline-flex cursor-help items-center gap-1 font-semibold text-warning-foreground">
                              <RotateCcw className="h-3 w-3" />{fmt(c, l[c.k])}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs text-xs">
                            Pedido reentregue: {l.reentrega.qtd} entregas (borderôs {l.reentrega.borderos.join(", ")}; NFs {l.reentrega.nfs.join(", ")}). Dados do borderô {l.bordero}; valores de frete somados.
                          </TooltipContent>
                        </Tooltip>
                      ) : fmt(c, l[c.k])}
                    </td>
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
      </TooltipProvider>
    </div>
  );
}
