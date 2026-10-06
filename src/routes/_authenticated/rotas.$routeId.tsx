import { BackButton } from "@/components/layout/BackButton";
import { PedidoCodigo } from "@/components/orders/PedidoCodigo";
import { Fragment, useCallback, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { listarPedidosDetalheRota, excluirRotaVazia, type PedidoDetalheRota } from "@/lib/rota-erp.functions";
import { localizarLocalidades, chaveLocalidade } from "@/lib/geo-localidades.functions";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Plus,
  Loader2,
  Pencil,
  MessageSquareText,
  Trash2,
  Printer,
} from "lucide-react";
import { toast } from "@/lib/toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import { AppShell } from "@/components/layout/AppShell";
import { useClientesErp } from "@/hooks/useClientesErp";
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
import { aproximarPorLocalidade } from "@/lib/route-stops";
import { formatCurrency, type OrderStatus } from "@/lib/orderStatus";
import { RouteEditDialog, type EditableRoute } from "@/components/routes/RouteEditDialog";
import {
  useResponsavelRota,
  nomeRotaDeNotes,
  TIPO_FRETE_LABEL,
  TIPO_FRETE_TONE,
} from "@/lib/rota-responsavel";
import type { Database } from "@/integrations/supabase/types";
import { AtribuirResponsavel } from "@/components/routes/AtribuirResponsavel";

const weightFmt = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
const percentageFmt = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

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
  head: () => ({ meta: [
    { title: "Detalhes da rota — SpeedFlow Logistics" },
    { name: "description", content: "Consulte pedidos, responsável e andamento da rota de entrega." },
    { property: "og:title", content: "Detalhes da rota — SpeedFlow Logistics" },
    { property: "og:description", content: "Consulte pedidos, responsável e andamento da rota de entrega." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  validateSearch: (s: Record<string, unknown>): { from?: "autorizar" | "pendentes" } =>
    s.from === "autorizar" || s.from === "pendentes" ? { from: s.from } : {},
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
  erp_route_id: string | null;
  erp_status: string | null;
  erp_carrier_code: string | null;
  driver_name: string | null;
  bordero_emitido_em: string | null;
  total_distance_km: number | null;
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
    bordero: string | null;
    customer_id: string | null;
    erp_cod_cliente: string | null;
    delivery_address: string | null;
    delivery_latitude: number | null;
    delivery_longitude: number | null;
    customer_geo: { latitude: number | null; longitude: number | null } | null;
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
  const { from: origem } = Route.useSearch();
  const qc = useQueryClient();
  const { role } = useAuth();
  const { nomeCliente } = useClientesErp();
  const canOperate = role === "adm" || role === "gestor" || role === "operador";
  const podeExcluir = role === "adm" || role === "gestor";
  const navigate = useNavigate();
  const excluirFn = useServerFn(excluirRotaVazia);
  const excluir = useMutation({
    mutationFn: () => excluirFn({ data: { routeId } }),
    onSuccess: () => {
      toast.success("Rota excluída");
      qc.invalidateQueries({ queryKey: ["routes"] });
      navigate({ to: "/rotas" });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : String(e)),
  });
  const [editOpen, setEditOpen] = useState(false);

  const routeQ = useQuery({
    queryKey: ["routes", routeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("routes")
        .select(
          "id,code,erp_route_id,erp_status,erp_carrier_code,driver_name,route_date,status,total_freight,total_distance_km,notes,carrier_id,bordero_emitido_em,freight_carriers(id,full_name,vehicle_plate,phone,transportadoras(cod_erp))",
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
          "id,stop_order,orders(id,order_number,status,total_amount,weight,bordero,customer_id,erp_cod_cliente,delivery_address,delivery_latitude,delivery_longitude)",
        )
        .eq("route_id", routeId)
        .order("stop_order");
      if (error) throw error;
      const rawStops = (data ?? []) as unknown as Stop[];
      const codes = Array.from(new Set(rawStops.map((s) => s.orders?.erp_cod_cliente).filter((v): v is string => Boolean(v))));
      if (codes.length === 0) return rawStops;
      const { data: geoRows, error: geoError } = await supabase
        .from("customer_geo")
        .select("cod_cliente,latitude,longitude")
        .in("cod_cliente", codes);
      if (geoError) throw geoError;
      const geoByCode = new Map(
        (geoRows ?? []).map((row) => [String(row.cod_cliente), { latitude: row.latitude, longitude: row.longitude }]),
      );
      return rawStops.map((stop) => {
        const order = stop.orders;
        const geo = order?.erp_cod_cliente ? geoByCode.get(String(order.erp_cod_cliente)) : undefined;
        return geo && order ? { ...stop, orders: { ...order, customer_geo: geo } } : stop;
      });
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
          "id,order_number,total_amount,erp_cod_cliente",
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
  const { responsavel, cod: codResponsavel } = useResponsavelRota({
    erpRouteId: route?.erp_route_id,
    codErpFallback: route?.erp_carrier_code ?? route?.freight_carriers?.transportadoras?.cod_erp ?? null,
  });
  const nomeResponsavel =
    responsavel?.razaoSocial || route?.driver_name || route?.freight_carriers?.full_name || "";
  const stops = stopsQ.data ?? [];
  const saveMapDistance = useCallback(
    async (distanceKm: number) => {
      const rounded = Math.round(distanceKm * 100) / 100;
      const current = routeQ.data?.total_distance_km;
      if (current != null && Math.abs(Number(current) - rounded) < 0.01) return;

      const { error } = await supabase
        .from("routes")
        .update({ total_distance_km: rounded })
        .eq("id", routeId);
      if (error) {
        console.warn("[RouteMapSection] não foi possível salvar a distância:", error);
        return;
      }
      qc.setQueryData<RouteDetail | null>(["routes", routeId], (previous) =>
        previous ? { ...previous, total_distance_km: rounded } : previous,
      );
      qc.invalidateQueries({ queryKey: ["routes"], exact: false });
    },
    [qc, routeId, routeQ.data?.total_distance_km],
  );
  const totals = useMemo(() => {
    let amount = 0;
    let weight = 0;
    let orders = 0;
    for (const s of stops) {
      if (!s.orders) continue;
      amount += Number(s.orders.total_amount ?? 0);
      weight += Number(s.orders.weight ?? 0);
      orders += 1;
    }
    return { stops: stops.length, orders, amount, weight };
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

  const editable = route.status === "planejada" && !route.bordero_emitido_em;

  return (
    <AppShell>
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          {origem === "autorizar" ? (
            <BackButton fallbackTo="/autorizar-pagamento-frete" fallbackLabel="Autorizar pagamento de frete" />
          ) : (
            <BackButton fallbackTo="/rotas" fallbackLabel="Rotas Pendentes" />
          )}
        </div>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {nomeRotaDeNotes(route.notes, route.code)}
            </h1>
            <p className="text-sm text-muted-foreground">
              <span className="font-mono">{route.code}</span>
              {" · "}
              {route.route_date && !route.route_date.startsWith("3000-01-01") && !route.route_date.startsWith("4000-01-01")
                ? format(new Date(route.route_date), "dd/MM/yyyy", { locale: ptBR })
                : "Não planejado"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate({ to: "/imprimir-rota/$routeId", params: { routeId: route.id } })}>
              <Printer className="h-4 w-4 mr-1" />
              Imprimir
            </Button>
            {route.erp_route_id && editable && (
              <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
                <Pencil className="h-4 w-4 mr-1" />
                Editar
              </Button>
            )}
            <span
              className={`inline-flex items-center rounded-md border px-3 py-1 text-sm font-medium ${ROUTE_STATUS_TONE[route.status]}`}
            >
              {ROUTE_STATUS_LABEL[route.status]}
            </span>
          </div>
        </div>

        {!editable && (
          <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-700">
            {route.bordero_emitido_em
              ? "Rota com borderô emitido no ERP — edição bloqueada."
              : "Esta rota não está mais pendente — edição bloqueada."}
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Responsável pelo frete</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {nomeResponsavel ? (
                <div className="text-sm space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{nomeResponsavel}</span>
                    {codResponsavel ? (
                      <span className="text-xs text-muted-foreground font-mono">({codResponsavel})</span>
                    ) : null}
                    {responsavel?.tipoFrete ? (
                      <span
                        className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${TIPO_FRETE_TONE[responsavel.tipoFrete]}`}
                      >
                        {TIPO_FRETE_LABEL[responsavel.tipoFrete]}
                      </span>
                    ) : null}
                  </div>
                  {route.freight_carriers ? (
                    <div className="text-xs text-muted-foreground">
                      {route.freight_carriers.vehicle_plate || "—"}
                      {route.freight_carriers.phone ? ` · ${route.freight_carriers.phone}` : ""}
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Sem responsável informado.</p>
                  {(role === "adm" || role === "gestor") && route.erp_route_id ? (
                    <AtribuirResponsavel
                      routeId={route.id}
                      nomeRota={nomeRotaDeNotes(route.notes, route.code)}
                    />
                  ) : null}
                </div>
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
                <span className="tabular-nums">{totals.stops}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Pedidos</span>
                <span className="tabular-nums">{totals.orders}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Valor total</span>
                <span className="tabular-nums">{formatCurrency(totals.amount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Peso total</span>
                <span className="tabular-nums">{weightFmt.format(totals.weight)} kg</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Frete</span>
                <span className="tabular-nums">{formatCurrency(Number(route.total_freight))}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">% do frete</span>
                <span className="tabular-nums">
                  {totals.amount > 0
                    ? `${percentageFmt.format((Number(route.total_freight) / totals.amount) * 100)}%`
                    : "—"}
                </span>
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
                {editable && (
                  <Button variant="outline" onClick={() => cancel.mutate()}>
                    <XCircle className="h-4 w-4 mr-2" />
                    Cancelar
                  </Button>
                )}
                {podeExcluir && stops.length === 0 && (
                  <Button
                    variant="destructive"
                    disabled={excluir.isPending}
                    onClick={() => {
                      const ok = window.confirm(
                        `Excluir a rota ${route.code}${route.erp_route_id ? ` (ERP ${route.erp_route_id})` : ""}? Esta ação marca a rota como Excluída no ERP.`,
                      );
                      if (ok) excluir.mutate();
                    }}
                  >
                    {excluir.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4 mr-2" />
                    )}
                    Excluir rota
                  </Button>
                )}
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

        <RouteMapSection
          stops={stops}
          depot={depot}
          nomeCliente={nomeCliente}
          onDistanceCalculated={saveMapDistance}
        />


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
                          <PedidoCodigo codigo={o.order_number} /> — {nomeCliente(o.erp_cod_cliente)}
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

        <RouteEditDialog
          route={
            route
              ? {
                  id: route.id,
                  code: route.code,
                  nomeRota: route.notes?.startsWith("Rota ")
                    ? route.notes.slice(5)
                    : route.code,
                  route_date: route.route_date,
                  notes: route.notes,
                  driver_name: route.freight_carriers?.full_name ?? null,
                  erp_route_id: route.erp_route_id,
                  erp_status: route.erp_status,
                }
              : null
          }
          open={editOpen}
          onOpenChange={(o) => {
            setEditOpen(o);
            if (!o) routeQ.refetch();
          }}
          initialCodErp={route?.freight_carriers?.transportadoras?.cod_erp ?? null}
          onSuccess={() => {
            qc.invalidateQueries({ queryKey: ["routes"] });
            qc.invalidateQueries({ queryKey: ["routes", routeId] });
            setEditOpen(false);
          }}
        />
      </div>
    </AppShell>
  );
}

function RouteMapSection({
  stops,
  depot,
  nomeCliente,
  onDistanceCalculated,
}: {
  stops: Stop[];
  depot: { lat: number; lng: number } | null;
  nomeCliente: (cod: string | null | undefined) => string;
  onDistanceCalculated: (distanceKm: number) => void;
}) {
  const exatos = stops
    .map((s) => {
      const o = s.orders;
      if (!o) return null;
       const coord = getOrderCoord({
         delivery_latitude: o.delivery_latitude,
         delivery_longitude: o.delivery_longitude,
         customer_geo: o.customer_geo,
       });
       if (!coord) return null;
       return {
         lat: coord.lat,
         lng: coord.lng,
         orderNumber: o.order_number,
         customerCode: o.erp_cod_cliente ?? null,
         customerName: o.erp_cod_cliente ? nomeCliente(o.erp_cod_cliente) : "—",
         city: null,
         state: null,
        weight: Number(o.weight ?? 0),
        amount: Number(o.total_amount ?? 0),
        bordero: o.bordero ?? null,
        orderId: o.id,
        kind: "new" as const,
        coordSource: coord.source as string,
        deliveryAddress: o.delivery_address,
      };
    })
    .filter((x): x is NonNullable<typeof x> => !!x);

  // Pedidos sem coordenada exata: aproxima pelo bairro/cidade do ERP.
  const pendentes = stops
    .map((s) => s.orders)
    .filter((o): o is NonNullable<typeof o> => !!o && !exatos.some((m) => m.orderId === o.id));
  const fetchDet = useServerFn(listarPedidosDetalheRota);
  const localizar = useServerFn(localizarLocalidades);
  const numsPend = pendentes.map((o) => o.order_number);
  const detPendQ = useQuery({
    queryKey: ["rota-pedidos-detalhe", numsPend],
    queryFn: () => fetchDet({ data: { pedidos: numsPend } }),
    staleTime: 60_000,
    enabled: numsPend.length > 0,
  });
  const locsPend = (detPendQ.data ?? []).flatMap((d) =>
    d.uf && d.cidade
      ? [
          { uf: d.uf, cidade: d.cidade, bairro: d.bairro ?? "" },
          { uf: d.uf, cidade: d.cidade, bairro: "" },
        ]
      : [],
  );
  const geoLocQ = useQuery({
    queryKey: ["geo-localidades", locsPend.map(chaveLocalidade).sort()],
    queryFn: () => localizar({ data: { localidades: locsPend } }),
    staleTime: 10 * 60_000,
    enabled: locsPend.length > 0,
  });
  const geoMap = new Map((geoLocQ.data ?? []).map((g) => [g.chave, g]));
  const detMap = new Map((detPendQ.data ?? []).map((d) => [d.pedido, d]));
  const aproximados: typeof exatos = [];
  const semGeo: { orderNumber: string; customerCode: string | null; coordSource: string; deliveryAddress: string | null; amount: number; weight: number; bordero: string | null }[] = [];
  for (const o of pendentes) {
    const d = detMap.get(o.order_number);
    const aprox = aproximarPorLocalidade(d, geoMap);
    const hit = aprox ? { lat: aprox.lat, lng: aprox.lng, src: aprox.source as string } : null;
    if (hit) {
      aproximados.push({
        lat: hit.lat,
        lng: hit.lng,
        orderNumber: o.order_number,
        customerCode: o.erp_cod_cliente ?? null,
        customerName: o.erp_cod_cliente ? nomeCliente(o.erp_cod_cliente) : "—",
        city: null,
        state: null,
        weight: Number(o.weight ?? 0),
        amount: Number(o.total_amount ?? 0),
        orderId: o.id,
        kind: "new" as const,
        coordSource: hit.src,
        deliveryAddress: o.delivery_address,
        bordero: o.bordero ?? null,
      });
    } else {
      semGeo.push({
        orderNumber: o.order_number,
        customerCode: o.erp_cod_cliente ?? null,
        coordSource: "none",
        deliveryAddress: o.delivery_address,
        amount: Number(o.total_amount ?? 0),
        weight: Number(o.weight ?? 0),
        bordero: o.bordero ?? null,
      });
    }
  }
  const mapStops = [...exatos, ...aproximados];

  if (mapStops.length === 0 && semGeo.length === 0) return null;

  const origin = depot ?? (mapStops[0] ? { lat: mapStops[0].lat, lng: mapStops[0].lng } : { lat: 0, lng: 0 });
  const ordered = mapStops.length > 0 ? sequenceStops(mapStops, origin) : [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Mapa e sequência da rota</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {mapStops.length > 0 && (
          <SuggestionMap
            stops={mapStops}
            depot={depot}
            onDistanceCalculated={onDistanceCalculated}
          />
        )}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-600" />
            <span className="text-emerald-700 font-medium">Entrega da rota</span>
          </div>
          {depot && (
            <span className="text-muted-foreground">Origem: depósito configurado</span>
          )}
          {aproximados.length > 0 && (
            <span className="font-medium text-amber-700">
              {aproximados.length} pedido(s) com posição aproximada (≈ bairro/cidade)
            </span>
          )}
          {semGeo.length > 0 && (
            <span className="font-medium text-amber-700">
              {semGeo.length} pedido(s) sem localização — listados no fim, fora do mapa
            </span>
          )}
        </div>
        <PedidosDaRotaTabela
          ordered={[
            ...ordered.map((st) => mapStops.find((m) => m.orderId === (st as typeof mapStops[number]).orderId)!),
            ...semGeo,
          ]}
          nomeCliente={nomeCliente}
        />
      </CardContent>
    </Card>
  );
}

function fmtDataErp(v: string | null) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return format(d, "dd/MM/yyyy");
}

function ObsHover({ texto }: { texto: string | null }) {
  if (!texto) return <span className="text-muted-foreground">—</span>;
  return (
    <HoverCard openDelay={100} closeDelay={50}>
      <HoverCardTrigger asChild>
        <button type="button" className="inline-flex items-center text-primary" aria-label="Ver conteúdo">
          <MessageSquareText className="h-4 w-4" />
        </button>
      </HoverCardTrigger>
      <HoverCardContent className="w-80 max-w-[90vw] whitespace-pre-wrap break-words text-xs">
        {texto}
      </HoverCardContent>
    </HoverCard>
  );
}

function PedidosDaRotaTabela({
  ordered,
  nomeCliente,
}: {
  ordered: { orderNumber: string; customerCode?: string | null; coordSource: string; deliveryAddress: string | null; amount?: number; weight?: number; bordero?: string | null }[];
  nomeCliente: (cod: string | null | undefined) => string;
}) {
  const fetchDetalhes = useServerFn(listarPedidosDetalheRota);
  const pedidos = ordered.map((o) => o.orderNumber);
  const detQ = useQuery({
    queryKey: ["rota-pedidos-detalhe", pedidos],
    queryFn: () => fetchDetalhes({ data: { pedidos } }),
    staleTime: 60_000,
    enabled: pedidos.length > 0,
  });
  const det = new Map((detQ.data ?? []).map((d) => [d.pedido, d]));

  // Agrupa por cliente mantendo a ordem da primeira parada de cada cliente.
  type Grupo = { key: string; cod: string | null; nome: string; uf: string | null; cidade: string | null; bairro: string | null; alt: string | null; semGeo: boolean; aprox: string | null; itens: { num: string; d?: PedidoDetalheRota; amount: number; weight: number; bordero: string | null }[] };
  const grupos: Grupo[] = [];
  const idx = new Map<string, Grupo>();
  for (const o of ordered) {
    const d = det.get(o.orderNumber);
    const cod = d?.codCliente ?? o.customerCode ?? null;
    const key = cod ?? `p-${o.orderNumber}`;
    let g = idx.get(key);
    if (!g) {
      g = {
        key,
        cod,
        nome: d?.cliente ?? (cod ? nomeCliente(cod) : "—"),
        uf: d?.uf ?? null,
        cidade: d?.cidade ?? null,
        bairro: d?.bairro ?? null,
        alt: o.coordSource === "order" ? o.deliveryAddress : null,
        semGeo: o.coordSource === "none",
        aprox: o.coordSource === "bairro" || o.coordSource === "cidade" ? o.coordSource : null,
        itens: [],
      };
      idx.set(key, g);
      grupos.push(g);
    }
    g.itens.push({ num: o.orderNumber, d, amount: Number(o.amount ?? 0), weight: Number(o.weight ?? 0), bordero: o.bordero ?? null });
  }

  const th = "px-1.5 py-1 text-left font-medium text-muted-foreground whitespace-nowrap";
  const td = "px-1.5 py-1 align-top";
  return (
    <div className="rounded border">
      {detQ.isLoading && (
        <div className="flex items-center gap-2 p-2 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" /> Carregando detalhes do ERP…
        </div>
      )}
      <table className="w-full table-auto text-[11px]">
        <thead className="bg-muted/50">
          <tr>
            <th className={th}>Pedido</th>
            <th className={th}>Status</th>
            <th className={th}>Filial</th>
            <th className={th}>NF</th>
            <th className={th}>Borderô</th>
            <th className={th}>Vendedor</th>
            <th className={th}>Agenda</th>
            <th className={th}>Dt. pedido</th>
            <th className={th}>Dt. agenda</th>
            <th className={`${th} text-right`}>Valor</th>
            <th className={`${th} text-right`}>Peso</th>
            <th className={th}>OBS</th>
            <th className={th}>OBS Logist</th>
            <th className={th}>INF_CMP</th>
          </tr>
        </thead>
        <tbody>
          {grupos.map((g, gi) => (
            <Fragment key={g.key}>
              <tr className="border-t bg-primary/5">
                <td colSpan={9} className="px-1.5 py-1 text-xs">
                  {/* totais da entrega nas colunas Valor/Peso */}
                  <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
                    {gi + 1}
                  </span>
                  <span className="font-semibold">{g.nome}</span>
                  {g.cod && <span className="text-muted-foreground"> ({g.cod})</span>}
                  <span className="text-muted-foreground">
                    {" · "}{g.uf ?? "—"} · {g.cidade ?? "—"} · {g.bairro ?? "—"}
                  </span>
                  {g.alt ? (
                    <span
                      className="ml-2 inline-flex items-center rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800"
                      title={`Endereço alternativo (OBS_LOGIST): ${g.alt}`}
                    >
                      endereço alternativo
                    </span>
                  ) : null}
                  {g.aprox ? (
                    <span
                      className="ml-2 inline-flex items-center rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800"
                      title={`Cliente sem localização exata: posição aproximada pelo centro do ${g.aprox}`}
                    >
                      ≈ {g.aprox}
                    </span>
                  ) : null}
                  {g.semGeo ? (
                    <span
                      className="ml-2 inline-flex items-center rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800"
                      title="Fora do mapa: sem coordenadas no pedido nem no cadastro do cliente"
                    >
                      Endereço não localizado
                    </span>
                  ) : null}
                  <span className="ml-2 text-muted-foreground">
                    · {g.itens.length} {g.itens.length === 1 ? "pedido" : "pedidos"}
                  </span>
                </td>
                <td className="px-1.5 py-1 text-right text-xs font-semibold tabular-nums whitespace-nowrap">
                  {formatCurrency(g.itens.reduce((a, i) => a + i.amount, 0))}
                </td>
                <td className="px-1.5 py-1 text-right text-xs font-semibold tabular-nums whitespace-nowrap">
                  {weightFmt.format(g.itens.reduce((a, i) => a + i.weight, 0))} kg
                </td>
                <td colSpan={3} />
              </tr>
              {g.itens.map(({ num, d, amount, weight, bordero }) => (
                <tr key={num} className="border-t border-dashed">
                  <td className={`${td} pl-8 whitespace-nowrap`}><PedidoCodigo codigo={num} /></td>
                  <td className={`${td} whitespace-nowrap`}>{d?.status ?? "—"}</td>
                  <td className={td}>{d?.codFilial ?? "—"}</td>
                  <td className={td}>{d?.nf ?? "—"}</td>
                  <td className={`${td} whitespace-nowrap tabular-nums`}>{bordero ?? "—"}</td>
                  <td className={td}>
                    {d?.vendedor ?? "—"}
                    {d?.codVendedor && <span className="text-muted-foreground"> ({d.codVendedor})</span>}
                  </td>
                  <td className={td}>{d?.codAgenda ?? "—"}</td>
                  <td className={`${td} whitespace-nowrap`}>{fmtDataErp(d?.dtPedido ?? null)}</td>
                  <td className={`${td} whitespace-nowrap`}>{fmtDataErp(d?.dtAgenda ?? null)}</td>
                  <td className={`${td} text-right tabular-nums whitespace-nowrap`}>{formatCurrency(amount)}</td>
                  <td className={`${td} text-right tabular-nums whitespace-nowrap`}>{weightFmt.format(weight)} kg</td>
                  <td className={td}><ObsHover texto={d?.obs ?? null} /></td>
                  <td className={td}><ObsHover texto={d?.obsLogist ?? null} /></td>
                  <td className={td}><ObsHover texto={d?.infCmp ?? null} /></td>
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
