import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Loader2, RefreshCw, Package, Weight, ShoppingCart, MapPin } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import { AppShell } from "@/components/layout/AppShell";
import { supabase } from "@/integrations/central/client";
import { computeRoutePolyline } from "@/lib/route-directions.functions";
import { sequenceStops } from "@/components/route-suggestions/SuggestionMap";
import { getOrderCoord } from "@/lib/order-coords";

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
  freight_carriers: { full_name: string; vehicle_plate: string | null } | null;
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
      customers: { latitude: number | null; longitude: number | null } | null;
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
function motoristaOf(r: RouteRow) {
  return r.driver_name ?? r.freight_carriers?.full_name ?? "";
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

function FreightInput({ route }: { route: RouteRow }) {
  const qc = useQueryClient();
  const [value, setValue] = useState<string>(
    route.total_freight ? String(route.total_freight) : "",
  );
  const initial = route.total_freight ?? 0;

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
    save.mutate(next);
  };

  return (
    <Input
      type="number"
      min="0"
      step="0.01"
      inputMode="decimal"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
      className="h-7 w-28 text-right tabular-nums text-xs"
      placeholder="0,00"
    />
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
          "id,code,route_date,status,total_freight,total_distance_km,driver_name,notes,freight_carriers(full_name,vehicle_plate),route_orders(stop_order,orders(customer_id,order_number,total_amount,weight,erp_status,delivery_latitude,delivery_longitude,customers(latitude,longitude)))",
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
        header: "Motorista",
        sortable: false,
        accessor: (r) => motoristaOf(r),
        render: (r) => motoristaOf(r) || <span className="text-muted-foreground">—</span>,
      },
      {
        id: "paradas",
        header: "Paradas",
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
        accessor: (r) => Number(r.total_freight ?? 0),
        render: (r) => <FreightInput route={r} />,
        className: "tabular-nums",
        aggregate: (rows) => (
          <span className="tabular-nums">
            {currencyFmt.format(rows.reduce((s, r) => s + Number(r.total_freight ?? 0), 0))}
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
          return v > 0 ? (Number(r.total_freight ?? 0) / v) * 100 : 0;
        },
        render: (r) => {
          const v = valorOf(r);
          const f = Number(r.total_freight ?? 0);
          if (v <= 0 || f <= 0) return <span className="text-muted-foreground">—</span>;
          return `${((f / v) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
        },
        className: "tabular-nums text-xs",
        aggregate: (rows) => {
          const v = rows.reduce((s, r) => s + valorOf(r), 0);
          const f = rows.reduce((s, r) => s + Number(r.total_freight ?? 0), 0);
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
    [depot],
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
            <h1 className="text-2xl font-bold tracking-tight">Rotas</h1>
            <p className="text-muted-foreground text-sm">
              Planeje rotas, atribua pedidos faturados e emita o borderô.
            </p>
          </div>
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Nova rota
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">Valor total das mercadorias</CardTitle>
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tabular-nums">
                {currencyFmt.format(totals.merchandise)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">Peso total</CardTitle>
              <Weight className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tabular-nums">
                {weightFmt.format(totals.weight)} kg
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">Quantidade de pedidos</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tabular-nums">
                {totals.orders.toLocaleString("pt-BR")}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">Quantidade de entregas</CardTitle>
              <MapPin className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tabular-nums">
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
            label: (key) =>
              `Total ${formatRouteDate(key)}`,
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
