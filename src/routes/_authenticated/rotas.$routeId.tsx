import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Play,
  CheckCircle2,
  XCircle,
  FileText,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import { AppShell } from "@/components/layout/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency, ORDER_STATUS_LABEL, STATUS_TONE, type OrderStatus } from "@/lib/orderStatus";
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

export const Route = createFileRoute("/_authenticated/rotas/$routeId")({
  component: RouteDetailPage,
});

type RouteDetail = {
  id: string;
  code: string;
  route_date: string;
  status: RouteStatus;
  total_freight: number;
  notes: string | null;
  carrier_id: string | null;
  freight_carriers: {
    id: string;
    full_name: string;
    vehicle_plate: string | null;
    phone: string | null;
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
    customers: { trade_name: string | null; legal_name: string; city: string | null; state: string | null } | null;
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

  const routeQ = useQuery({
    queryKey: ["routes", routeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("routes")
        .select(
          "id,code,route_date,status,total_freight,notes,carrier_id,freight_carriers(id,full_name,vehicle_plate,phone)",
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
          "id,stop_order,orders(id,order_number,status,total_amount,customers(trade_name,legal_name,city,state))",
        )
        .eq("route_id", routeId)
        .order("stop_order");
      if (error) throw error;
      return (data ?? []) as unknown as Stop[];
    },
  });

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

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Paradas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {editable && canOperate ? (
              <div className="flex gap-2">
                <Select value={pickOrder} onValueChange={setPickOrder}>
                  <SelectTrigger className="flex-1">
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
                          #{o.order_number} —{" "}
                          {o.customers?.trade_name || o.customers?.legal_name}
                          {o.customers?.city ? ` · ${o.customers.city}` : ""}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                <Button onClick={() => addStop.mutate()} disabled={addStop.isPending}>
                  <Plus className="h-4 w-4 mr-1" /> Adicionar
                </Button>
              </div>
            ) : null}

            {stopsQ.isLoading ? (
              <Skeleton className="h-20 w-full" />
            ) : stops.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                Nenhuma parada nesta rota.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Pedido</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    {editable && canOperate ? <TableHead className="w-12"></TableHead> : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stops.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="tabular-nums">{s.stop_order}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {s.orders ? (
                          <Link
                            to="/pedidos/$orderId"
                            params={{ orderId: s.orders.id }}
                            className="text-primary hover:underline"
                          >
                            #{s.orders.order_number}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>
                        {s.orders?.customers?.trade_name ||
                          s.orders?.customers?.legal_name ||
                          "—"}
                        {s.orders?.customers?.city ? (
                          <div className="text-xs text-muted-foreground">
                            {s.orders.customers.city}
                            {s.orders.customers.state ? `/${s.orders.customers.state}` : ""}
                          </div>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        {s.orders ? (
                          <span
                            className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] ${STATUS_TONE[s.orders.status]}`}
                          >
                            {ORDER_STATUS_LABEL[s.orders.status]}
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(Number(s.orders?.total_amount ?? 0))}
                      </TableCell>
                      {editable && canOperate ? (
                        <TableCell>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => removeStop.mutate(s.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      ) : null}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
