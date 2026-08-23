import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Loader2, RefreshCw, Package, Weight, ShoppingCart, MapPin, Calculator } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import { AppShell } from "@/components/layout/AppShell";
import { supabase } from "@/integrations/central/client";
import { computeRoutePolyline } from "@/lib/route-directions.functions";
import { sequenceStops } from "@/components/route-suggestions/SuggestionMap";
import { getOrderCoord } from "@/lib/order-coords";
import {
  simularRota,
  tabelaVigenteDaTransportadora,
  type SimulacaoRota,
  type TabelaSim,
} from "@/lib/frete-simulacao";


import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DataTable, type ColumnDef } from "@/components/data-table/DataTable";
import type { Database } from "@/integrations/supabase/types";

type RouteStatus = Database["public"]["Enums"]["route_status"];

const ROUTE_STATUS_LABEL: Record<RouteStatus, string> = {
  planejada: "Planejada",
  em_andamento: "Em andamento",
  concluida: "Concluída",
  cancelada: "Cancelada",
};
const ROUTE_STATUS_TONE: Record<RouteStatus, string> = {
  planejada: "bg-blue-500/15 text-blue-600 border-blue-500/30",
  em_andamento: "bg-cyan-500/15 text-cyan-600 border-cyan-500/30",
  concluida: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
  cancelada: "bg-muted text-muted-foreground border-border",
};

export const Route = createFileRoute("/_authenticated/rotas/")({
  component: RotasPage,
});

type RouteRow = {
  id: string;
  code: string;
  route_date: string;
  status: RouteStatus;
  total_freight: number;
  total_distance_km: number | null;
  driver_name: string | null;
  notes: string | null;
  freight_carriers: {
    full_name: string;
    vehicle_plate: string | null;
    transportadoras: { id: string; cod_erp: string | null } | null;
  } | null;
  route_orders: {
    stop_order: number | null;
    orders: {
      customer_id: string | null;
      order_number: string | null;
      total_amount: number | null;
      weight: number | null;
      erp_status: string | null;
      delivery_latitude: number | null;
      delivery_longitude: number | null;
      customers: { latitude: number | null; longitude: number | null; city: string | null } | null;
    } | null;
  }[];
};


const currencyFmt = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});
const weightFmt = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

function formatRouteDate(value: string | null | undefined): string {
  if (!value) return "";
  const iso = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  const dmy = String(value).match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (dmy) {
    const d = dmy[1].padStart(2, "0");
    const m = dmy[2].padStart(2, "0");
    let y = dmy[3];
    if (y.length === 2) y = `20${y}`;
    return `${d}/${m}/${y}`;
  }
  return String(value);
}

function nomeRotaOf(r: RouteRow) {
  return r.notes?.startsWith("Rota ") ? r.notes.slice(5) : r.code;
}
function motoristaOf(r: RouteRow, codFallback?: string | null) {
  const name = r.driver_name ?? r.freight_carriers?.full_name ?? "";
  const cod = r.freight_carriers?.transportadoras?.cod_erp ?? codFallback ?? null;
  if (name && cod) return `${name} (${cod})`;
  return name;
}

type TransportadoraLite = { id: string; razao_social: string; cod_erp: string | null };

const normalizaNome = (v: string) =>
  v
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();

/**
 * Resolve a transportadora da rota. Prioriza o vínculo por `freight_carriers`;
 * quando a rota veio do ERP sem esse vínculo, casa pelo nome (o ERP trunca a
 * razão social, então comparamos por prefixo).
 */
function resolveTransportadora(
  r: RouteRow,
  transportadoras: TransportadoraLite[],
): TransportadoraLite | null {
  const vinculada = r.freight_carriers?.transportadoras?.id;
  if (vinculada) {
    return (
      transportadoras.find((t) => t.id === vinculada) ?? {
        id: vinculada,
        razao_social: "",
        cod_erp: r.freight_carriers?.transportadoras?.cod_erp ?? null,
      }
    );
  }
  const nome = normalizaNome(r.driver_name ?? r.freight_carriers?.full_name ?? "");
  if (nome.length < 4) return null;
  return (
    transportadoras.find((t) => {
      const alvo = normalizaNome(t.razao_social ?? "");
      return alvo === nome || alvo.startsWith(nome) || nome.startsWith(alvo);
    }) ?? null
  );
}

function paradasOf(r: RouteRow) {
  const set = new Set<string>();
  for (const ro of r.route_orders ?? []) {
    if (ro.orders?.customer_id) set.add(ro.orders.customer_id);
  }
  return set.size;
}
function pedidosOf(r: RouteRow) {
  return (r.route_orders ?? []).length;
}
function valorOf(r: RouteRow) {
  let total = 0;
  for (const ro of r.route_orders ?? []) total += Number(ro.orders?.total_amount ?? 0);
  return total;
}
function pesoOf(r: RouteRow) {
  let total = 0;
  for (const ro of r.route_orders ?? []) total += Number(ro.orders?.weight ?? 0);
  return total;
}
function statusMapOf(r: RouteRow) {
  const m = new Map<string, Set<string>>();
  for (const ro of r.route_orders ?? []) {
    const o = ro.orders;
    if (!o) continue;
    const st = o.erp_status ?? "—";
    if (!m.has(st)) m.set(st, new Set());
    m.get(st)!.add(o.order_number ?? "");
  }
  return new Map(Array.from(m.entries()).map(([k, v]) => [k, v.size]));
}
function expedicaoStatusOf(r: RouteRow): "E" | "P" {
  const ros = r.route_orders ?? [];
  if (ros.length === 0) return "P";
  const allExpedidos = ros.every((ro) => (ro.orders?.erp_status ?? "") === "11-EXPEDIDO");
  return allExpedidos ? "E" : "P";
}


function slugify(s: string): string {
  return (
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "rota"
  );
}

function StatusList({ map }: { map: Map<string, number> }) {
  const sorted = Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  if (sorted.length === 0) return <span className="text-muted-foreground text-xs">—</span>;
  return (
    <div className="flex flex-col gap-0.5 text-xs">
      {sorted.map(([st, count]) => (
        <div key={st} className="flex items-center justify-between gap-3">
          <span className="font-medium">{st}</span>
          <span className="tabular-nums text-muted-foreground">{count}</span>
        </div>
      ))}
    </div>
  );
}

function FreightInput({
  route,
  estimate,
}: {
  route: RouteRow;
  estimate: SimulacaoRota | null;
}) {
  const qc = useQueryClient();
  const initial = Number(route.total_freight ?? 0);
  const isEstimate = initial <= 0 && estimate != null;
  const [value, setValue] = useState<string>(
    initial > 0 ? String(initial) : isEstimate ? String(estimate!.total) : "",
  );
  const [estimated, setEstimated] = useState(isEstimate);

  const save = useMutation({
    mutationFn: async (next: number) => {
      const { error } = await supabase
        .from("routes")
        .update({ total_freight: next })
        .eq("id", route.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Frete atualizado");
      qc.invalidateQueries({ queryKey: ["routes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const commit = () => {
    const n = Number(value.replace(",", "."));
    const next = Number.isFinite(n) ? n : 0;
    if (next === initial) return;
    setEstimated(false);
    save.mutate(next);
  };

  const title = estimate
    ? `Estimativa calculada pela tabela de preço "${estimate.tabelaNome}" (${estimate.entregasCalculadas} de ${estimate.entregasTotal} entregas${estimate.parcial ? " — praça não identificada nas demais" : ""}). Edite para confirmar o valor real.`
    : undefined;

  return (
    <span className="inline-flex items-center gap-1 justify-end">
      {estimated && (
        <span
          title={title}
          className="inline-flex items-center gap-0.5 rounded border border-amber-500/30 bg-amber-500/15 px-1 py-0.5 text-[10px] font-semibold text-amber-600"
        >
          <Calculator className="h-3 w-3" /> est.
        </span>
      )}
      <Input
        type="number"
        min="0"
        step="0.01"
        inputMode="decimal"
        value={value}
        title={estimated ? title : undefined}
        onChange={(e) => {
          setValue(e.target.value);
          setEstimated(false);
        }}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
        className={`h-7 w-28 text-right tabular-nums text-xs ${
          estimated ? "border-amber-500/40 bg-amber-500/10 italic text-amber-700" : ""
        }`}
        placeholder="0,00"
      />
    </span>
  );
}


function DistanceCell({
  route,
  depot,
}: {
  route: RouteRow;
  depot: { lat: number; lng: number } | null;
}) {
  const compute = useServerFn(computeRoutePolyline);
  const qc = useQueryClient();
  const attempted = useRef(false);
  const [value, setValue] = useState<number | null>(() => {
    const v = route.total_distance_km;
    if (v == null) return null;
    const n = Number(v);
    return n > 0 ? n : null;
  });
  const [computing, setComputing] = useState(false);

  const stops = useMemo(() => {
    const ros = [...(route.route_orders ?? [])].sort(
      (a, b) => (a.stop_order ?? 0) - (b.stop_order ?? 0),
    );
    const pts: { lat: number; lng: number; orderNumber: string; customerName: string; kind: "new" }[] = [];
    for (const ro of ros) {
      const ordersRaw = ro.orders as unknown;
      const order = (Array.isArray(ordersRaw) ? ordersRaw[0] : ordersRaw) as
        | {
            order_number?: string | null;
            customers?: unknown;
            delivery_latitude?: number | string | null;
            delivery_longitude?: number | string | null;
          }
        | null
        | undefined;
      if (!order) continue;
      const customersRaw = order.customers;
      const c = (Array.isArray(customersRaw) ? customersRaw[0] : customersRaw) as
        | { latitude?: number | string | null; longitude?: number | string | null }
        | null
        | undefined;
      const coord = getOrderCoord({
        delivery_latitude: order.delivery_latitude,
        delivery_longitude: order.delivery_longitude,
        customers: c ?? null,
      });
      if (!coord) continue;
      pts.push({
        lat: coord.lat,
        lng: coord.lng,
        orderNumber: order.order_number ?? "",
        customerName: "",
        kind: "new",
      });
    }
    return pts;
  }, [route]);

  useEffect(() => {
    if (value != null) return;
    if (attempted.current) return;
    if (stops.length < 1) return;

    const ordered = sequenceStops(stops, depot);
    const pathPoints = depot
      ? [depot, ...ordered.map((s) => ({ lat: s.lat, lng: s.lng }))]
      : ordered.map((s) => ({ lat: s.lat, lng: s.lng }));
    if (pathPoints.length < 2) return;

    attempted.current = true;
    setComputing(true);
    (async () => {
      const MAX = 25;
      let totalMeters = 0;
      try {
        for (let i = 0; i < pathPoints.length - 1; i += MAX - 1) {
          const segment = pathPoints.slice(i, i + MAX);
          const origin = segment[0];
          const destination = segment[segment.length - 1];
          const waypoints = segment.slice(1, -1);
          const result = await compute({ data: { origin, destination, waypoints } });
          totalMeters += result.distanceMeters ?? 0;
        }
        const km = totalMeters > 0 ? totalMeters / 1000 : 0;
        const rounded = Math.round(km * 100) / 100;
        setValue(rounded);
        await supabase
          .from("routes")
          .update({ total_distance_km: rounded })
          .eq("id", route.id);
        qc.invalidateQueries({ queryKey: ["routes"] });
      } catch (err) {
        console.warn("[DistanceCell] falhou:", err);
        attempted.current = false;
      } finally {
        setComputing(false);
      }
    })();
  }, [stops, depot, value, compute, qc, route.id]);



  const triggerRecalc = () => {
    attempted.current = false;
    setValue(null);
  };

  return (
    <div className="inline-flex items-center gap-1 justify-end">
      {computing ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : value != null ? (
        <span>{value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}</span>
      ) : (
        <span className="text-muted-foreground">—</span>
      )}
      <button
        type="button"
        onClick={triggerRecalc}
        disabled={computing}
        title="Recalcular distância"
        className="text-muted-foreground hover:text-foreground disabled:opacity-40"
      >
        <RefreshCw className="h-3 w-3" />
      </button>
    </div>
  );
}


function RotasPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [filteredData, setFilteredData] = useState<RouteRow[] | undefined>();

  const depotQ = useQuery({
    queryKey: ["company_settings", "depot"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_settings")
        .select("depot_latitude, depot_longitude")
        .eq("id", 1)
        .maybeSingle();
      if (error) throw error;
      if (data?.depot_latitude != null && data?.depot_longitude != null) {
        return { lat: Number(data.depot_latitude), lng: Number(data.depot_longitude) };
      }
      return null;
    },
  });
  const depot = depotQ.data ?? null;



  const { data, isLoading } = useQuery({
    queryKey: ["routes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("routes")
        .select(
          "id,code,route_date,status,total_freight,total_distance_km,driver_name,notes,freight_carriers(full_name,vehicle_plate,transportadoras(id,cod_erp)),route_orders(stop_order,orders(customer_id,order_number,total_amount,weight,erp_status,delivery_latitude,delivery_longitude,customers(latitude,longitude,city)))",
        );
      if (error) throw error;
      const rows = ((data ?? []) as unknown as RouteRow[]).filter(
        (r) => (r.route_orders ?? []).length > 0,
      );
      rows.sort((a, b) => {
        const d = String(a.route_date).localeCompare(String(b.route_date));
        if (d !== 0) return d;
        return nomeRotaOf(a).localeCompare(nomeRotaOf(b), undefined, {
          sensitivity: "base",
        });
      });
      return rows;
    },
  });

  const tabelasQ = useQuery({
    queryKey: ["tabelas-frete-simulacao"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tabelas_preco_frete")
        .select("*, tabelas_preco_frete_faixas(*), tabelas_preco_frete_rotas(*)")
        .eq("ativo", true);
      if (error) throw error;
      return (data ?? []) as unknown as TabelaSim[];
    },
  });

  const vinculosQ = useQuery({
    queryKey: ["tabelas-frete-vinculos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tabelas_preco_frete_transportadoras")
        .select("tabela_id, transportadora_id");
      if (error) throw error;
      return (data ?? []) as { tabela_id: string; transportadora_id: string }[];
    },
  });


  const transportadorasQ = useQuery({
    queryKey: ["transportadoras-simulacao"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transportadoras")
        .select("id, razao_social, cod_erp")
        .eq("ativo", true);
      if (error) throw error;
      return (data ?? []) as TransportadoraLite[];
    },
  });

  /** Transportadora resolvida por rota (vínculo direto ou casamento por nome). */
  const transpPorRota = useMemo(() => {
    const map = new Map<string, TransportadoraLite>();
    const lista = transportadorasQ.data ?? [];
    for (const r of data ?? []) {
      const t = resolveTransportadora(r, lista);
      if (t) map.set(r.id, t);
    }
    return map;
  }, [data, transportadorasQ.data]);

  const estimativas = useMemo(() => {
    const map = new Map<string, SimulacaoRota>();
    const tabelas = tabelasQ.data ?? [];
    const vinculos = vinculosQ.data ?? [];
    if (!tabelas.length) return map;
    for (const r of data ?? []) {
      const transportadoraId = transpPorRota.get(r.id)?.id;
      if (!transportadoraId) continue;
      const tabela = tabelaVigenteDaTransportadora(tabelas, vinculos, transportadoraId);
      if (!tabela) continue;

      // Uma entrega por cliente da rota: soma peso e valor dos pedidos.
      const porCliente = new Map<
        string,
        { peso: number; valorMercadoria: number; municipio: string | null }
      >();
      for (const ro of r.route_orders ?? []) {
        const o = ro.orders;
        if (!o?.customer_id) continue;
        const atual = porCliente.get(o.customer_id) ?? {
          peso: 0,
          valorMercadoria: 0,
          municipio: o.customers?.city ?? null,
        };
        atual.peso += Number(o.weight ?? 0);
        atual.valorMercadoria += Number(o.total_amount ?? 0);
        if (!atual.municipio) atual.municipio = o.customers?.city ?? null;
        porCliente.set(o.customer_id, atual);
      }
      const sim = simularRota(tabela, Array.from(porCliente.values()));
      if (sim) map.set(r.id, sim);
    }
    return map;
  }, [data, tabelasQ.data, vinculosQ.data]);

  /** Frete informado; na ausência, a estimativa da tabela da transportadora. */
  const freteOf = useMemo(
    () => (r: RouteRow) =>
      Number(r.total_freight ?? 0) > 0
        ? Number(r.total_freight)
        : (estimativas.get(r.id)?.total ?? 0),
    [estimativas],
  );

  const columns = useMemo<ColumnDef<RouteRow>[]>(

    () => [
      {
        id: "route_date",
        header: "Data planejada",
        sortable: false,
        accessor: (r) => r.route_date,
        render: (r) => (
          <Link
            to="/rotas/$routeId"
            params={{ routeId: r.id }}
            className="text-primary hover:underline"
          >
            {formatRouteDate(r.route_date)}
          </Link>
        ),
      },
      {
        id: "nome_rota",
        header: "Nome da rota",
        sortable: false,
        accessor: (r) => nomeRotaOf(r),
      },
      {
        id: "motorista",
        header: "Fret / Transp",
        sortable: false,
        accessor: (r) => motoristaOf(r),
        render: (r) => motoristaOf(r) || <span className="text-muted-foreground">—</span>,
      },
      {
        id: "paradas",
        header: "Qtd Entregas",
        sortable: false,
        align: "right",
        accessor: (r) => paradasOf(r),
        className: "tabular-nums",
        aggregate: (rows) => (
          <span className="tabular-nums">
            {rows.reduce((s, r) => s + paradasOf(r), 0)}
          </span>
        ),
      },
      {
        id: "valor_total",
        header: "Valor total",
        sortable: false,
        align: "right",
        accessor: (r) => valorOf(r),
        render: (r) => currencyFmt.format(valorOf(r)),
        className: "tabular-nums",
        aggregate: (rows) => (
          <span className="tabular-nums">
            {currencyFmt.format(rows.reduce((s, r) => s + valorOf(r), 0))}
          </span>
        ),
      },
      {
        id: "peso_total",
        header: "Peso total (kg)",
        sortable: false,
        align: "right",
        accessor: (r) => pesoOf(r),
        render: (r) => weightFmt.format(pesoOf(r)),
        className: "tabular-nums",
        aggregate: (rows) => (
          <span className="tabular-nums">
            {weightFmt.format(rows.reduce((s, r) => s + pesoOf(r), 0))}
          </span>
        ),
      },
      {
        id: "total_distance_km",
        header: "Distância (km)",
        sortable: false,
        align: "right",
        filterable: false,
        accessor: (r) => Number(r.total_distance_km ?? 0),
        render: (r) => <DistanceCell route={r} depot={depot} />,
        className: "tabular-nums text-xs",
        aggregate: (rows) => (
          <span className="tabular-nums">
            {rows
              .reduce((s, r) => s + Number(r.total_distance_km ?? 0), 0)
              .toLocaleString("pt-BR", { maximumFractionDigits: 1 })}
          </span>
        ),
      },
      {
        id: "total_freight",
        header: "Frete (R$)",
        sortable: false,
        align: "right",
        filterable: false,
        accessor: (r) => freteOf(r),
        render: (r) => (
          <FreightInput
            key={`${r.id}-${r.total_freight ?? 0}-${estimativas.get(r.id)?.total ?? 0}`}
            route={r}
            estimate={estimativas.get(r.id) ?? null}
          />
        ),
        className: "tabular-nums",
        aggregate: (rows) => (
          <span className="tabular-nums">
            {currencyFmt.format(rows.reduce((s, r) => s + freteOf(r), 0))}
          </span>
        ),
      },

      {
        id: "freight_pct",
        header: "% Frete",
        sortable: false,
        align: "right",
        filterable: false,
        accessor: (r) => {
          const v = valorOf(r);
          return v > 0 ? (freteOf(r) / v) * 100 : 0;
        },
        render: (r) => {
          const v = valorOf(r);
          const f = freteOf(r);
          if (v <= 0 || f <= 0) return <span className="text-muted-foreground">—</span>;
          const est = Number(r.total_freight ?? 0) <= 0;
          return (
            <span className={est ? "italic text-amber-600" : undefined} title={est ? "Baseado na estimativa da tabela de preço" : undefined}>
              {((f / v) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%
            </span>
          );
        },
        className: "tabular-nums text-xs",
        aggregate: (rows) => {
          const v = rows.reduce((s, r) => s + valorOf(r), 0);
          const f = rows.reduce((s, r) => s + freteOf(r), 0);
          if (v <= 0 || f <= 0) return <span className="text-muted-foreground">—</span>;
          return (
            <span className="tabular-nums">
              {((f / v) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%
            </span>
          );
        },

      },
      {

        id: "pedidos_status",
        header: "Pedidos por status",
        sortable: false,
        filterable: false,
        accessor: (r) =>
          Array.from(statusMapOf(r).keys()).join(", "),
        render: (r) => <StatusList map={statusMapOf(r)} />,
        aggregate: (rows) => {
          const agg = new Map<string, number>();
          for (const r of rows) {
            for (const [st, c] of statusMapOf(r)) {
              agg.set(st, (agg.get(st) ?? 0) + c);
            }
          }
          return <StatusList map={agg} />;
        },
      },
      {
        id: "exp_status",
        header: "Exp.",
        sortable: false,
        align: "center",
        accessor: (r) => expedicaoStatusOf(r),
        render: (r) => {
          const s = expedicaoStatusOf(r);
          const tone =
            s === "E"
              ? "bg-emerald-500/15 text-emerald-600 border-emerald-500/30"
              : "bg-blue-500/15 text-blue-600 border-blue-500/30";
          const title = s === "E" ? "Expedida" : "Planejada";
          return (
            <span
              title={title}
              className={`inline-flex h-6 w-6 items-center justify-center rounded-md border text-xs font-bold ${tone}`}
            >
              {s}
            </span>
          );
        },
      },
      {
        id: "status",
        header: "Status",
        sortable: false,
        defaultVisible: false,
        accessor: (r) => ROUTE_STATUS_LABEL[r.status],
        render: (r) => (
          <span
            className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${ROUTE_STATUS_TONE[r.status]}`}
          >
            {ROUTE_STATUS_LABEL[r.status]}
          </span>
        ),
      },
    ],
    [depot, estimativas, freteOf],
  );


  const totals = useMemo(() => {
    const rows = filteredData ?? data ?? [];
    return {
      merchandise: rows.reduce((s, r) => s + valorOf(r), 0),
      weight: rows.reduce((s, r) => s + pesoOf(r), 0),
      orders: rows.reduce((s, r) => s + pedidosOf(r), 0),
      stops: rows.reduce((s, r) => s + paradasOf(r), 0),
    };
  }, [filteredData, data]);

  return (
    <AppShell>
      <div className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Rotas</h1>
            <p className="text-muted-foreground text-sm">
              Planeje rotas, atribua pedidos faturados e emita o borderô.
            </p>
          </div>
          <Button onClick={() => setOpen(true)} className="w-full sm:w-auto">
            <Plus className="h-4 w-4 mr-1" /> Nova rota
          </Button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-2 p-3 pb-1 space-y-0 sm:p-6 sm:pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium leading-tight">Valor total das mercadorias</CardTitle>
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
              <div className="text-lg sm:text-2xl font-bold tabular-nums break-words">
                {currencyFmt.format(totals.merchandise)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-2 p-3 pb-1 space-y-0 sm:p-6 sm:pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium leading-tight">Peso total</CardTitle>
              <Weight className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
              <div className="text-lg sm:text-2xl font-bold tabular-nums break-words">
                {weightFmt.format(totals.weight)} kg
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-2 p-3 pb-1 space-y-0 sm:p-6 sm:pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium leading-tight">Quantidade de pedidos</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
              <div className="text-lg sm:text-2xl font-bold tabular-nums break-words">
                {totals.orders.toLocaleString("pt-BR")}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-2 p-3 pb-1 space-y-0 sm:p-6 sm:pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium leading-tight">Quantidade de entregas</CardTitle>
              <MapPin className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
              <div className="text-lg sm:text-2xl font-bold tabular-nums break-words">
                {totals.stops.toLocaleString("pt-BR")}
              </div>
            </CardContent>
          </Card>
        </div>

        <DataTable
          tableKey="rotas"
          columns={columns}
          data={data}
          isLoading={isLoading}
          rowKey={(r) => r.id}
          emptyMessage="Nenhuma rota criada."
          onFilteredChange={setFilteredData}
          groupBy={{
            id: "route_date",
            accessor: (r) => r.route_date,
            label: (key, rows) => {
              const valor = rows.reduce((s, r) => s + valorOf(r), 0);
              const peso = rows.reduce((s, r) => s + pesoOf(r), 0);
              return `Total ${formatRouteDate(key)} · ${currencyFmt.format(valor)} · ${weightFmt.format(peso)} kg`;
            },
          }}
        />
      </div>

      <NewRouteDialog
        open={open}
        onOpenChange={setOpen}
        onCreated={() => qc.invalidateQueries({ queryKey: ["routes"] })}
      />
    </AppShell>
  );
}

function NewRouteDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated: () => void;
}) {
  const [routeDate, setRouteDate] = useState(new Date().toISOString().slice(0, 10));
  const [routeName, setRouteName] = useState("");
  const [driverName, setDriverName] = useState("");
  const [freight, setFreight] = useState("0");
  const [notes, setNotes] = useState("");

  const create = useMutation({
    mutationFn: async () => {
      if (!routeName.trim()) throw new Error("Informe o nome da rota");
      const code = `${slugify(routeName)}-${routeDate.replace(/-/g, "")}`;
      const { error } = await supabase.from("routes").insert({
        code,
        route_date: routeDate,
        driver_name: driverName.trim() || null,
        total_freight: Number(freight || 0),
        notes: notes.trim() ? notes : `Rota ${routeName.trim()}`,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Rota criada");
      onCreated();
      onOpenChange(false);
      setRouteName("");
      setDriverName("");
      setFreight("0");
      setNotes("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova rota</DialogTitle>
          <DialogDescription>
            Crie a rota e, na próxima tela, atribua pedidos faturados.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5 md:col-span-2">
            <Label className="text-xs">Nome da rota *</Label>
            <Input
              value={routeName}
              onChange={(e) => setRouteName(e.target.value)}
              placeholder="Ex: Rota Centro"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Data planejada de saída *</Label>
            <Input type="date" value={routeDate} onChange={(e) => setRouteDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Frete total (R$)</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={freight}
              onChange={(e) => setFreight(e.target.value)}
            />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label className="text-xs">Motorista</Label>
            <Input
              value={driverName}
              onChange={(e) => setDriverName(e.target.value)}
              placeholder="Nome do motorista"
            />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label className="text-xs">Observações</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => create.mutate()} disabled={create.isPending}>
            {create.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Criar rota
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
