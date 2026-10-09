import { Fragment, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/central/client";
import { useAuth } from "@/hooks/useAuth";
import { listarPedidosDetalheRota, type PedidoDetalheRota } from "@/lib/rota-erp.functions";
import { getOrderCoord } from "@/lib/order-coords";
import { SuggestionMap, sequenceStops, type MapStop } from "@/components/route-suggestions/SuggestionMap";
import { nomeRotaDeNotes } from "@/lib/rota-responsavel";
import { isStatusCriticoErp } from "@/lib/erp-status";
import { PrintLayout } from "./PrintLayout";
import { usePrintPrefs, type PrintBasePrefs } from "./usePrintPrefs";

type Prefs = PrintBasePrefs & {
  resumo: boolean;
  mapa: boolean;
  entregas: boolean;
  observacoes: boolean;
  assinaturas: boolean;
  ordem: "rota" | "cliente";
};
const DEFAULTS: Prefs = {
  paper: "A4",
  orientation: "portrait",
  fontSize: "sm",
  economico: false,
  resumo: true,
  mapa: true,
  entregas: true,
  observacoes: true,
  assinaturas: true,
  ordem: "rota",
};

type Num = number | string | null;
type Stop = {
  stop_order: number | null;
  orders: {
    order_number: string;
    total_amount: Num;
    weight: Num;
    bordero: string | null;
    erp_cod_cliente: string | null;
    delivery_latitude: Num;
    delivery_longitude: Num;
    customer_geo?: { latitude: Num; longitude: Num };
  } | null;
};

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const kg = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
const n = (v: Num) => Number(v ?? 0) || 0;
const dt = (v?: string | null) => {
  if (!v) return "—";
  const d = new Date(v.length === 10 ? `${v}T12:00:00` : v);
  return Number.isNaN(d.getTime()) ? v : d.toLocaleDateString("pt-BR");
};

export function RotaPrintDocument({ routeId }: { routeId: string }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [prefs, setPrefs] = usePrintPrefs<Prefs>("rota", DEFAULTS);
  const fetchDet = useServerFn(listarPedidosDetalheRota);

  const routeQ = useQuery({
    queryKey: ["print-route", routeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("routes")
        .select("id,code,erp_route_id,driver_name,route_date,status,total_freight,total_distance_km,notes,freight_carriers(full_name,vehicle_plate)")
        .eq("id", routeId)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as {
        code: string; erp_route_id: string | null; driver_name: string | null; route_date: string | null;
        status: string; total_freight: Num; total_distance_km: Num; notes: string | null;
        freight_carriers: { full_name: string | null; vehicle_plate: string | null } | null;
      } | null;
    },
  });

  const stopsQ = useQuery({
    queryKey: ["print-route", routeId, "stops"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("route_orders")
        .select("stop_order,orders(order_number,total_amount,weight,bordero,erp_cod_cliente,delivery_latitude,delivery_longitude)")
        .eq("route_id", routeId)
        .order("stop_order");
      if (error) throw error;
      const stops = (data ?? []) as unknown as Stop[];
      const codes = Array.from(new Set(stops.map((s) => s.orders?.erp_cod_cliente).filter((v): v is string => !!v)));
      if (!codes.length) return stops;
      const { data: geo } = await supabase.from("customer_geo").select("cod_cliente,latitude,longitude").in("cod_cliente", codes);
      const map = new Map((geo ?? []).map((g) => [String(g.cod_cliente), g]));
      return stops.map((s) => {
        const g = s.orders?.erp_cod_cliente ? map.get(s.orders.erp_cod_cliente) : undefined;
        return g && s.orders ? { ...s, orders: { ...s.orders, customer_geo: { latitude: g.latitude, longitude: g.longitude } } } : s;
      });
    },
  });

  const depotQ = useQuery({
    queryKey: ["company_settings", "depot"],
    queryFn: async () => {
      const { data } = await supabase.from("company_settings").select("depot_latitude, depot_longitude").eq("id", 1).maybeSingle();
      return data?.depot_latitude != null && data?.depot_longitude != null
        ? { lat: Number(data.depot_latitude), lng: Number(data.depot_longitude) }
        : null;
    },
  });

  const pedidos = (stopsQ.data ?? []).map((s) => s.orders?.order_number).filter((v): v is string => !!v);
  const detQ = useQuery({
    queryKey: ["rota-pedidos-detalhe", pedidos],
    queryFn: () => fetchDet({ data: { pedidos } }),
    enabled: pedidos.length > 0,
    staleTime: 60_000,
  });

  const linhas = useMemo(() => {
    const det = new Map<string, PedidoDetalheRota>((detQ.data ?? []).map((d) => [d.pedido, d]));
    return (stopsQ.data ?? [])
      .filter((s) => s.orders)
      .map((s, i) => {
        const o = s.orders!;
        return { seq: s.stop_order ?? i + 1, o, d: det.get(o.order_number) ?? null };
      });
  }, [stopsQ.data, detQ.data]);

  const grupos = useMemo(() => {
    const m = new Map<string, typeof linhas>();
    for (const l of linhas) {
      const k = l.o.erp_cod_cliente ?? l.d?.codCliente ?? l.o.order_number;
      m.set(k, [...(m.get(k) ?? []), l]);
    }
    const arr = Array.from(m.values());
    if (prefs.ordem === "cliente") {
      const key = (g: typeof linhas) => `${g[0].d?.uf ?? ""}|${g[0].d?.cidade ?? ""}|${g[0].d?.bairro ?? ""}|${g[0].d?.cliente ?? ""}`;
      arr.sort((a, b) => key(a).localeCompare(key(b), "pt-BR"));
    }
    return arr;
  }, [linhas, prefs.ordem]);

  const mapStops = useMemo<MapStop[]>(() => {
    const pts: MapStop[] = [];
    for (const l of linhas) {
      const c = getOrderCoord(l.o as never);
      if (c) pts.push({ lat: c.lat, lng: c.lng, orderNumber: l.o.order_number, customerName: l.d?.cliente ?? "", kind: "existing" });
    }
    return sequenceStops(pts, depotQ.data ?? null);
  }, [linhas, depotQ.data]);

  const route = routeQ.data;

  // Sugere o nome do arquivo ao salvar PDF: RT_<código da rota>_<data yyyymmdd>.pdf
  // (navegadores usam o título da aba como nome sugerido no diálogo "Salvar como PDF").
  useEffect(() => {
    if (!route) return;
    const original = document.title;
    const d = new Date();
    const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
    const codigo = String(route.erp_route_id ?? route.code ?? "").replace(/[^\w-]/g, "");
    document.title = `RT_${codigo}_${ymd}`;
    return () => {
      document.title = original;
    };
  }, [route]);
  const totalValor = linhas.reduce((s, l) => s + n(l.o.total_amount), 0);
  const totalPeso = linhas.reduce((s, l) => s + n(l.o.weight), 0);
  const frete = n(route?.total_freight ?? 0);
  const cidades = Array.from(new Set(linhas.map((l) => (l.d?.cidade ? `${l.d.cidade}/${l.d.uf ?? ""}` : null)).filter(Boolean)));
  const ready = !routeQ.isLoading && !stopsQ.isLoading && (pedidos.length === 0 || !detQ.isLoading);
  const nomeRota = route ? nomeRotaDeNotes(route.notes, route.code) : "";
  const opt = (key: keyof Prefs & string, label: string) => ({
    key, label, checked: Boolean(prefs[key]), onChange: (v: boolean) => setPrefs({ [key]: v } as Partial<Prefs>),
  });

  return (
    <PrintLayout
      title={route ? `Rota ${route.erp_route_id ?? route.code} — ${nomeRota}` : "Detalhamento da rota"}
      subtitle={route ? `Data ${dt(route.route_date)} · Responsável: ${route.freight_carriers?.full_name ?? route.driver_name ?? "—"}${route.freight_carriers?.vehicle_plate ? ` · Placa ${route.freight_carriers.vehicle_plate}` : ""}` : undefined}
      prefs={prefs}
      onPrefs={(p) => setPrefs(p as Partial<Prefs>)}
      ready={ready}
      printedBy={(user?.user_metadata?.full_name as string | undefined) ?? user?.email ?? null}
      onBack={() => (window.history.length > 1 ? window.history.back() : navigate({ to: "/rotas" }))}
      options={[
        opt("resumo", "Resumo"),
        opt("mapa", "Mapa"),
        opt("entregas", "Entregas e pedidos"),
        opt("observacoes", "Observações"),
        opt("assinaturas", "Assinaturas"),
      ]}
      extraControls={
        <select
          className="h-8 rounded-md border bg-background px-2"
          value={prefs.ordem}
          onChange={(e) => setPrefs({ ordem: e.target.value as Prefs["ordem"] })}
          aria-label="Ordenação"
        >
          <option value="rota">Ordem da rota</option>
          <option value="cliente">Por UF/cidade/cliente</option>
        </select>
      }
    >
      {!ready && <p className="text-muted-foreground">Carregando dados da rota…</p>}
      {ready && !route && <p>Rota não encontrada.</p>}
      {ready && route && (
        <div className="space-y-4">
          {prefs.resumo && (
            <section className="avoid-break grid grid-cols-3 gap-2 sm:grid-cols-6">
              {[
                ["Entregas", String(grupos.length)],
                ["Pedidos", String(linhas.length)],
                ["Valor", money.format(totalValor)],
                ["Peso", `${kg.format(totalPeso)} kg`],
                ["Distância", route.total_distance_km ? `${kg.format(n(route.total_distance_km))} km` : "—"],
                ["Frete", frete ? `${money.format(frete)}${totalValor ? ` (${((frete / totalValor) * 100).toFixed(2).replace(".", ",")}%)` : ""}` : "—"],
              ].map(([l, v]) => (
                <div key={l} className="print-band rounded border p-2">
                  <div className="text-[0.8em] uppercase text-muted-foreground">{l}</div>
                  <div className="font-semibold">{v}</div>
                </div>
              ))}
              {cidades.length > 0 && (
                <div className="col-span-full text-[0.9em]"><b>Praças:</b> {cidades.join(", ")}</div>
              )}
            </section>
          )}

          {prefs.mapa && mapStops.length > 0 && (
            <section className="avoid-break overflow-hidden rounded border">
              <SuggestionMap stops={mapStops} depot={depotQ.data ?? null} height={320} />
            </section>
          )}

          {prefs.entregas && (
            <section>
              <table>
                <thead>
                  <tr>
                    <th>Pedido</th><th>Status</th><th>Filial</th><th>NF</th><th>Borderô</th>
                    <th>Vendedor</th><th>Agenda</th><th>Dt. pedido</th><th>Dt. fatur.</th>
                    <th className="num">Valor</th><th className="num">Peso (kg)</th>
                    {prefs.observacoes && <th>Observações</th>}
                  </tr>
                </thead>
                <tbody>
                  {grupos.map((g, gi) => {
                    const primeira = g[0];
                    if (!primeira) return null;
                    const codigoCliente = primeira.o.erp_cod_cliente ?? primeira.d?.codCliente;
                    const endereco = [primeira.d?.uf, primeira.d?.cidade, primeira.d?.bairro].filter(Boolean).join(" · ") || "—";
                    const valorEntrega = g.reduce((s, x) => s + n(x.o.total_amount), 0);
                    const pesoEntrega = g.reduce((s, x) => s + n(x.o.weight), 0);
                    return (
                      <Fragment key={codigoCliente ?? primeira.o.order_number}>
                        <tr className="print-delivery-total font-semibold">
                          <td colSpan={prefs.observacoes ? 12 : 11}>
                            <div className="flex items-center gap-2">
                              <span className="print-stop-number">{gi + 1}</span>
                              <span>
                                {primeira.d?.cliente ?? "—"}{codigoCliente ? ` (${codigoCliente})` : ""}
                                <span className="font-normal text-muted-foreground"> · {endereco} · {g.length} {g.length === 1 ? "pedido" : "pedidos"}</span>
                              </span>
                              <span className="ml-auto whitespace-nowrap">{money.format(valorEntrega)} · {kg.format(pesoEntrega)} kg</span>
                            </div>
                          </td>
                        </tr>
                        {g.map((l) => (
                          <tr key={l.o.order_number}>
                            <td>{l.o.order_number}</td>
                            <td className={isStatusCriticoErp(l.d?.status) ? "text-destructive" : undefined}>{l.d?.status ?? "—"}</td>
                            <td>{l.d?.codFilial ?? "—"}</td>
                            <td>{l.d?.nf ?? "—"}</td>
                            <td>{l.o.bordero ?? "—"}</td>
                            <td>{l.d?.vendedor ? `${l.d.vendedor}${l.d.codVendedor ? ` (${l.d.codVendedor})` : ""}` : "—"}</td>
                            <td>{l.d?.codAgenda ?? "—"}</td>
                            <td>{dt(l.d?.dtPedido)}</td>
                            <td>{dt(l.d?.dtAgenda)}</td>
                            <td className="num">{money.format(n(l.o.total_amount))}</td>
                            <td className="num">{kg.format(n(l.o.weight))}</td>
                            {prefs.observacoes && (
                              <td className="max-w-[42mm] whitespace-pre-wrap">
                                {[l.d?.obs, l.d?.obsLogist && `Logíst.: ${l.d.obsLogist}`, l.d?.infCmp].filter(Boolean).join(" · ") || ""}
                              </td>
                            )}
                          </tr>
                        ))}
                      </Fragment>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="font-semibold">
                    <td colSpan={9}>Total — {grupos.length} entregas · {linhas.length} pedidos</td>
                    <td className="num">{money.format(totalValor)}</td>
                    <td className="num">{kg.format(totalPeso)}</td>
                    {prefs.observacoes && <td />}
                  </tr>
                </tfoot>
              </table>
            </section>
          )}

          {prefs.assinaturas && (
            <section className="avoid-break grid grid-cols-3 gap-8 pt-10">
              {["Motorista / Fretista", "Conferente", "Expedição"].map((s) => (
                <div key={s} className="border-t border-foreground pt-1 text-center text-[0.9em]">{s}</div>
              ))}
            </section>
          )}
        </div>
      )}
    </PrintLayout>
  );
}
