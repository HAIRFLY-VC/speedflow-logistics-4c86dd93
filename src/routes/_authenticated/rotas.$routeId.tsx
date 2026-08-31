import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Plus,
  Play,
  CheckCircle2,
  XCircle,
  FileText,
  Loader2,
  Pencil,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import { AppShell } from "@/components/layout/AppShell";
import { supabase } from "@/integrations/central/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SuggestionMap, sequenceStops } from "@/components/route-suggestions/SuggestionMap";
import { getOrderCoord } from "@/lib/order-coords";
import { formatCurrency, type OrderStatus } from "@/lib/orderStatus";
import { RouteEditDialog, type EditableRoute } from "@/components/routes/RouteEditDialog";
import type { Database } from "@/integrations/supabase/types";

const weightFmt = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

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

export const Route = createFileRoute("/_authenticated/rotas/$routeId")({
  component: RouteDetailPage,
});

type RouteDetail = {
  id: string;
  code: string;
  route_date: string | null;
  status: RouteStatus;
  total_freight: number;
  notes: string | null;
  carrier_id: string | null;
  erp_route_id: string | null;
  erp_status: string | null;
  freight_carriers: {
    id: string;
    full_name: string;
    vehicle_plate: string | null;
    phone: string | null;
    transportadoras: { cod_erp: string | null } | null;
  } | null;
};

type Stop = {
  id: string;
  stop_order: number;
  orders: {
    id: string;
    order_number: string;
    status: OrderStatus;
    total_amount: number;
    weight: number | null;
    customer_id: string | null;
    delivery_address: string | null;
    delivery_latitude: number | null;
    delivery_longitude: number | null;
    customers: {
      trade_name: string | null;
      legal_name: string;
      city: string | null;
      state: string | null;
      latitude: number | null;
      longitude: number | null;
    } | null;
  } | null;
};

type Manifest = {
  id: string;
  code: string;
  issued_at: string;
  notes: string | null;
};

function RouteDetailPage() {
  const { routeId } = Route.useParams();
  const qc = useQueryClient();
  const { user, role } = useAuth();
  const canOperate = role === "adm" || role === "gestor" || role === "operador";
  const [editOpen, setEditOpen] = useState(false);

  const routeQ = useQuery({
    queryKey: ["routes", routeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("routes")
        .select(
          "id,code,erp_route_id,erp_status,route_date,status,total_freight,notes,carrier_id,freight_carriers(id,full_name,vehicle_plate,phone,transportadoras(cod_erp))",
        )
        .eq("id", routeId)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as RouteDetail | null;
    },
  });

  const stopsQ = useQuery({
    queryKey: ["routes", routeId, "stops"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("route_orders")
        .select(
          "id,stop_order,orders(id,order_number,status,total_amount,weight,customer_id,delivery_address,delivery_latitude,delivery_longitude,customers(trade_name,legal_name,city,state,latitude,longitude))",
        )
        .eq("route_id", routeId)
        .order("stop_order");
      if (error) throw error;
      return (data ?? []) as unknown as Stop[];
    },
  });

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

  const manifestQ = useQuery({
    queryKey: ["routes", routeId, "manifest"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("delivery_manifests")
        .select("id,code,issued_at,notes")
        .eq("route_id", routeId)
        .order("issued_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as Manifest | null;
    },
  });

  const availableQ = useQuery({
    queryKey: ["orders", "available-for-route"],
    queryFn: async () => {
      const { data: routed, error: rErr } = await supabase
        .from("route_orders")
        .select("order_id");
      if (rErr) throw rErr;
      const excluded = (routed ?? []).map((r) => r.order_id);

      let q = supabase
        .from("orders")
        .select(
          "id,order_number,total_amount,customers(trade_name,legal_name,city,state)",
        )
        .eq("status", "faturado" as OrderStatus)
        .order("created_at", { ascending: false });
      if (excluded.length) q = q.not("id", "in", `(${excluded.join(",")})`);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const route = routeQ.data;
  const stops = stopsQ.data ?? [];
  const totals = useMemo(() => {
    let amount = 0;
    for (const s of stops) amount += Number(s.orders?.total_amount ?? 0);
    return { count: stops.length, amount };
  }, [stops]);

  function invalidateAll() {
    qc.invalidateQueries({ queryKey: ["routes"] });
    qc.invalidateQueries({ queryKey: ["routes", routeId] });
    qc.invalidateQueries({ queryKey: ["routes", routeId, "stops"] });
    qc.invalidateQueries({ queryKey: ["routes", routeId, "manifest"] });
    qc.invalidateQueries({ queryKey: ["orders"] });
    qc.invalidateQueries({ queryKey: ["orders", "available-for-route"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
    qc.invalidateQueries({ queryKey: ["kanban"] });
  }

  const [pickOrder, setPickOrder] = useState("");

  const addStop = useMutation({
    mutationFn: async () => {
      if (!pickOrder) throw new Error("Selecione um pedido");
      const next = (stops[stops.length - 1]?.stop_order ?? 0) + 1;
      const { error } = await supabase.from("route_orders").insert({
        route_id: routeId,
        order_id: pickOrder,
        stop_order: next,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pedido adicionado à rota");
      setPickOrder("");
      invalidateAll();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeStop = useMutation({
    mutationFn: async (stopId: string) => {
      const { error } = await supabase.from("route_orders").delete().eq("id", stopId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pedido removido da rota");
      invalidateAll();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const start = useMutation({
    mutationFn: async () => {
      if (!route) return;
      if (!route.carrier_id) throw new Error("Atribua um fretista antes de iniciar");
      if (stops.length === 0) throw new Error("Adicione pelo menos um pedido");
      for (const s of stops) {
        if (!s.orders) continue;
        const { error } = await supabase
          .from("orders")
          .update({ status: "em_transporte" as OrderStatus })
          .eq("id", s.orders.id);
        if (error) throw error;
      }
      const { error: rErr } = await supabase
        .from("routes")
        .update({ status: "em_andamento" })
        .eq("id", routeId);
      if (rErr) throw rErr;
    },
    onSuccess: () => {
      toast.success("Rota iniciada — pedidos em transporte");
      invalidateAll();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const finish = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("routes")
        .update({ status: "concluida" })
        .eq("id", routeId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Rota concluída");
      invalidateAll();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancel = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("routes")
        .update({ status: "cancelada" })
        .eq("id", routeId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Rota cancelada");
      invalidateAll();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const issueManifest = useMutation({
    mutationFn: async () => {
      if (stops.length === 0) throw new Error("Rota sem pedidos");
      const code = `BOR-${route?.route_date.replace(/-/g, "")}-${Math.floor(
        Math.random() * 1000,
      )
        .toString()
        .padStart(3, "0")}`;
      const { error } = await supabase.from("delivery_manifests").insert({
        route_id: routeId,
        code,
        issued_by: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Borderô emitido");
      invalidateAll();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const carrierAssign = useMutation({
    mutationFn: async (cid: string) => {
      const { error } = await supabase
        .from("routes")
        .update({ carrier_id: cid || null })
        .eq("id", routeId);
      if (error) throw error;
    },
    onSuccess: () => invalidateAll(),
  });

  const carriersQ = useQuery({
    queryKey: ["carriers", "active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("freight_carriers")
        .select("id,full_name,vehicle_plate")
        .eq("is_active", true)
        .order("full_name");
      if (error) throw error;
      return data;
    },
  });

  if (routeQ.isLoading) {
    return (
      <AppShell>
        <Skeleton className="h-40 w-full" />
      </AppShell>
    );
  }

  if (!route) {
    return (
      <AppShell>
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            Rota não encontrada.
          </CardContent>
        </Card>
      </AppShell>
    );
  }

  const editable = route.status === "planejada";

  return (
    <AppShell>
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link to="/rotas">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Rotas
            </Link>
          </Button>
        </div>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight font-mono">{route.code}</h1>
            <p className="text-sm text-muted-foreground">
              {format(new Date(route.route_date), "dd/MM/yyyy", { locale: ptBR })}
            </p>
          </div>
          <span
            className={`inline-flex items-center rounded-md border px-3 py-1 text-sm font-medium ${ROUTE_STATUS_TONE[route.status]}`}
          >
            {ROUTE_STATUS_LABEL[route.status]}
          </span>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Fretista</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {editable && canOperate ? (
                <Select
                  value={route.carrier_id ?? ""}
                  onValueChange={(v) => carrierAssign.mutate(v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o fretista" />
                  </SelectTrigger>
                  <SelectContent>
                    {(carriersQ.data ?? []).map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.full_name}
                        {c.vehicle_plate ? ` · ${c.vehicle_plate}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : route.freight_carriers ? (
                <div className="text-sm">
                  <div className="font-medium">{route.freight_carriers.full_name}</div>
                  <div className="text-xs text-muted-foreground">
                    {route.freight_carriers.vehicle_plate || "—"}
                    {route.freight_carriers.phone ? ` · ${route.freight_carriers.phone}` : ""}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Sem fretista atribuído.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Resumo</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Paradas</span>
                <span className="tabular-nums">{totals.count}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Valor total</span>
                <span className="tabular-nums">{formatCurrency(totals.amount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Frete</span>
                <span className="tabular-nums">{formatCurrency(Number(route.total_freight))}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {canOperate ? (
          <div className="flex flex-wrap gap-2">
            {route.status === "planejada" && (
              <>
                <Button onClick={() => start.mutate()} disabled={start.isPending}>
                  {start.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4 mr-2" />
                  )}
                  Iniciar rota
                </Button>
                <Button variant="outline" onClick={() => cancel.mutate()}>
                  <XCircle className="h-4 w-4 mr-2" />
                  Cancelar
                </Button>
              </>
            )}
            {route.status === "em_andamento" && (
              <Button onClick={() => finish.mutate()} disabled={finish.isPending}>
                {finish.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                )}
                Concluir rota
              </Button>
            )}
            {!manifestQ.data && stops.length > 0 && route.status !== "cancelada" && (
              <Button variant="outline" onClick={() => issueManifest.mutate()}>
                <FileText className="h-4 w-4 mr-2" />
                Emitir borderô
              </Button>
            )}
          </div>
        ) : null}

        {manifestQ.data ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Borderô</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-1">
              <div className="font-mono">{manifestQ.data.code}</div>
              <div className="text-xs text-muted-foreground">
                Emitido em {format(new Date(manifestQ.data.issued_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
              </div>
            </CardContent>
          </Card>
        ) : null}

        <RouteMapSection stops={stops} depot={depot} />


        {editable && canOperate ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Adicionar pedido à rota</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Select value={pickOrder} onValueChange={setPickOrder}>
                  <SelectTrigger className="w-full min-w-0 sm:flex-1">
                    <SelectValue placeholder="Selecione um pedido faturado para adicionar" />
                  </SelectTrigger>
                  <SelectContent>
                    {(availableQ.data ?? []).length === 0 ? (
                      <div className="p-2 text-xs text-muted-foreground">
                        Nenhum pedido faturado disponível.
                      </div>
                    ) : (
                      (availableQ.data ?? []).map((o) => (
                        <SelectItem key={o.id} value={o.id}>
                          {o.order_number} —{" "}
                          {o.customers?.trade_name || o.customers?.legal_name}
                          {o.customers?.city ? ` · ${o.customers.city}` : ""}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                <Button
                  onClick={() => addStop.mutate()}
                  disabled={addStop.isPending}
                  className="w-full sm:w-auto"
                >
                  <Plus className="h-4 w-4 mr-1" /> Adicionar
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </AppShell>
  );
}

function RouteMapSection({
  stops,
  depot,
}: {
  stops: Stop[];
  depot: { lat: number; lng: number } | null;
}) {
  const mapStops = stops
    .map((s) => {
      const o = s.orders;
      if (!o) return null;
      const coord = getOrderCoord({
        delivery_latitude: o.delivery_latitude,
        delivery_longitude: o.delivery_longitude,
        customers: o.customers,
      });
      if (!coord) return null;
      const c = o.customers;
      return {
        lat: coord.lat,
        lng: coord.lng,
        orderNumber: o.order_number,
        customerName: c?.trade_name || c?.legal_name || "—",
        city: c?.city ?? null,
        state: c?.state ?? null,
        weight: Number(o.weight ?? 0),
        amount: Number(o.total_amount ?? 0),
        orderId: o.id,
        kind: "new" as const,
        coordSource: coord.source,
        deliveryAddress: o.delivery_address,
      };
    })
    .filter((x): x is NonNullable<typeof x> => !!x);

  if (mapStops.length === 0) return null;

  const origin = depot ?? { lat: mapStops[0].lat, lng: mapStops[0].lng };
  const ordered = sequenceStops(mapStops, origin);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Mapa e sequência da rota</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <SuggestionMap stops={mapStops} depot={depot} />
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-600" />
            <span className="text-emerald-700 font-medium">Entrega da rota</span>
          </div>
          {depot && (
            <span className="text-muted-foreground">Origem: depósito configurado</span>
          )}
        </div>
        <ol className="list-decimal list-inside space-y-0.5 text-sm">
          {ordered.map((st, i) => {
            const full = mapStops.find((m) => m.orderId === (st as typeof mapStops[number]).orderId)!;
            return (
              <li key={`${full.orderId}-${i}`}>
                <span className="text-emerald-600 font-medium">{full.orderNumber}</span>{" "}
                <span className="text-emerald-700/80">
                  — {full.customerName} · {full.city ?? "?"}/{full.state ?? "?"} ·{" "}
                  {weightFmt.format(full.weight)} kg · {formatCurrency(full.amount)}
                </span>
                {full.coordSource === "order" && full.deliveryAddress ? (
                  <span
                    className="ml-2 inline-flex items-center rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800"
                    title={`Endereço alternativo (OBS_LOGIST): ${full.deliveryAddress}`}
                  >
                    endereço alternativo
                  </span>
                ) : null}
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}
