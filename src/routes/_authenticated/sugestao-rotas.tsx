import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Wand2, MapPin, CheckCircle2, X, Pencil, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

import { AppShell } from "@/components/layout/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { SuggestionMap } from "@/components/route-suggestions/SuggestionMap";
import {
  geocodePendingCustomers,
  suggestRoutes,
  confirmRouteSuggestion,
  type RouteSuggestion,
} from "@/lib/route-suggestions.functions";

export const Route = createFileRoute("/_authenticated/sugestao-rotas")({
  component: SugestaoRotasPage,
});

const currencyFmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const weightFmt = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

type ExistingRouteInfo = {
  id: string;
  label: string;
  date: string;
  driverName: string | null;
  existingWeight: number;
  existingValue: number;
  existingDeliveries: number;
  capacityWeight: number;
};

type SuggestState = {
  suggestions: RouteSuggestion[];
  missingGeocode: { id: string; order_number: string; customer: string; city: string | null }[];
  depot: { lat: number; lng: number } | null;
  config: { maxWeight: number; maxValue: number; radiusKm: number };
  existingRoutes: ExistingRouteInfo[];
} | null;

function SugestaoRotasPage() {
  const qc = useQueryClient();
  const geocodeFn = useServerFn(geocodePendingCustomers);
  const suggestFn = useServerFn(suggestRoutes);
  const confirmFn = useServerFn(confirmRouteSuggestion);

  const [state, setState] = useState<SuggestState>(null);
  const [editing, setEditing] = useState<RouteSuggestion | null>(null);
  const [detailRoute, setDetailRoute] = useState<{ id: string; label: string } | null>(null);

  const pending = useQuery({
    queryKey: ["unrouted-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select(
          "id, order_number, total_amount, weight, customers(trade_name, legal_name, city, state, latitude, longitude)",
        )
        .gte("dt_prev_exp", "3999-01-01")
        .order("order_number");
      if (error) throw error;
      return data ?? [];
    },
  });

  const customersMissingCoords = useQuery({
    queryKey: ["customers-missing-coords"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("customers")
        .select("*", { count: "exact", head: true })
        .or("latitude.is.null,longitude.is.null");
      if (error) throw error;
      return count ?? 0;
    },
  });

  const geocode = useMutation({
    mutationFn: () => geocodeFn({}),
    onSuccess: (r) => {
      toast.success(`Geocodificados: ${r.geocoded} | Falhas: ${r.failed}`);
      qc.invalidateQueries({ queryKey: ["unrouted-orders"] });
      qc.invalidateQueries({ queryKey: ["customers-missing-coords"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const suggest = useMutation({
    mutationFn: () => suggestFn({}),
    onSuccess: (r) => {
      setState(r);
      if (!r.suggestions.length) toast.info("Nenhuma sugestão gerada.");
      else toast.success(`${r.suggestions.length} sugestão(ões) geradas`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const confirm = useMutation({
    mutationFn: (s: RouteSuggestion) => confirmFn({ data: { suggestion: s } }),
    onSuccess: (_r, s) => {
      toast.success(`Rota confirmada (${s.stops.length} pedidos)`);
      setState((prev) =>
        prev ? { ...prev, suggestions: prev.suggestions.filter((x) => x.id !== s.id) } : prev,
      );
      qc.invalidateQueries({ queryKey: ["unrouted-orders"] });
      qc.invalidateQueries({ queryKey: ["routes"] });
      qc.invalidateQueries({ queryKey: ["orders"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const dismiss = (s: RouteSuggestion) => {
    setState((prev) =>
      prev ? { ...prev, suggestions: prev.suggestions.filter((x) => x.id !== s.id) } : prev,
    );
  };

  const onSaveEdit = (next: RouteSuggestion) => {
    setState((prev) =>
      prev
        ? { ...prev, suggestions: prev.suggestions.map((x) => (x.id === next.id ? next : x)) }
        : prev,
    );
    setEditing(null);
  };

  const acceptAll = async () => {
    if (!state?.suggestions.length) return;
    const list = [...state.suggestions];
    let ok = 0;
    let fail = 0;
    for (const s of list) {
      try {
        await confirmFn({ data: { suggestion: s } });
        ok++;
      } catch {
        fail++;
      }
    }
    toast.success(`Confirmadas: ${ok}${fail ? ` · Falhas: ${fail}` : ""}`);
    setState((prev) => (prev ? { ...prev, suggestions: [] } : prev));
    qc.invalidateQueries({ queryKey: ["unrouted-orders"] });
    qc.invalidateQueries({ queryKey: ["routes"] });
  };

  const pendingRows = pending.data ?? [];
  const missingCoords = pendingRows.filter(
    (r) =>
      !r.customers || r.customers.latitude == null || r.customers.longitude == null,
  ).length;

  return (
    <AppShell>
      <div className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Sugestão de rotas</h1>
            <p className="text-muted-foreground text-sm">
              Pedidos sem roteirização (DT_PREV_EXP = 01/01/4000) — agrupados com Google Maps.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => geocode.mutate()}
              disabled={geocode.isPending || (customersMissingCoords.data ?? 0) === 0}
              title="Geocodifica todos os clientes da base que não têm latitude/longitude cadastrada"
            >
              {geocode.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <MapPin className="h-4 w-4 mr-2" />
              )}
              Geocodificar
              {customersMissingCoords.data != null ? ` (${customersMissingCoords.data})` : ""}
            </Button>
            <Button onClick={() => suggest.mutate()} disabled={suggest.isPending || pendingRows.length === 0}>
              {suggest.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Wand2 className="h-4 w-4 mr-2" />
              )}
              Gerar sugestões
            </Button>
          </div>
        </div>

        <div className={cn("grid gap-4", state ? "grid-cols-1" : "grid-cols-1 lg:grid-cols-[380px_1fr]")}>
          {/* Pedidos sem rota */}
          {!state && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center justify-between">
                  <span>Pedidos sem rota</span>
                  <Badge variant="secondary">{pendingRows.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 max-h-[70vh] overflow-auto">
                {pending.isLoading ? (
                  <div className="p-3 space-y-2">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ) : pendingRows.length === 0 ? (
                  <p className="text-sm text-muted-foreground p-4">Nenhum pedido pendente. 🎉</p>
                ) : (
                  <ul className="text-sm divide-y">
                    {pendingRows.map((r) => {
                      const c = r.customers;
                      const noCoord = !c || c.latitude == null || c.longitude == null;
                      return (
                        <li key={r.id} className="px-3 py-2 flex flex-col gap-0.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium">{r.order_number}</span>
                            {noCoord && (
                              <Badge variant="outline" className="text-amber-600 border-amber-500/40">
                                <AlertTriangle className="h-3 w-3 mr-1" /> sem lat/lng
                              </Badge>
                            )}
                          </div>
                          <span className="text-muted-foreground text-xs">
                            {c?.trade_name || c?.legal_name || "—"} · {c?.city ?? "?"}/{c?.state ?? "?"}
                          </span>
                          <span className="text-muted-foreground text-xs tabular-nums">
                            {currencyFmt.format(Number(r.total_amount ?? 0))} ·{" "}
                            {weightFmt.format(Number(r.weight ?? 0))} kg
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>
          )}

          {/* Sugestões */}
          <div className="space-y-3">
            {state && state.suggestions.length > 1 && (
              <div className="flex justify-end">
                <Button size="sm" variant="default" onClick={acceptAll}>
                  <CheckCircle2 className="h-4 w-4 mr-1" /> Confirmar todas
                </Button>
              </div>
            )}

            {!state && (
              <Card>
                <CardContent className="p-6 text-sm text-muted-foreground">
                  Clique em <strong>Gerar sugestões</strong> para que o app monte propostas de
                  roteirização para os pedidos pendentes, usando endereço dos clientes e
                  capacidade configurada (peso/valor) por veículo.
                </CardContent>
              </Card>
            )}

            {state && state.suggestions.length === 0 && (
              <Card>
                <CardContent className="p-6 text-sm text-muted-foreground">
                  Nenhuma sugestão gerada. Verifique se os clientes têm latitude/longitude e se
                  as configurações de capacidade estão coerentes.
                </CardContent>
              </Card>
            )}

            {state?.suggestions.map((s) => (
              <SuggestionCard
                key={s.id}
                suggestion={s}
                depot={state.depot}
                onConfirm={() => confirm.mutate(s)}
                onEdit={() => setEditing(s)}
                onDismiss={() => dismiss(s)}
                onShowExistingDetail={() =>
                  s.routeId && setDetailRoute({ id: s.routeId, label: s.routeLabel })
                }
                isConfirming={confirm.isPending}
              />
            ))}

            {state && state.missingGeocode.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base text-amber-600">
                    Pedidos não considerados (sem coordenadas)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="text-sm space-y-1">
                    {state.missingGeocode.map((m) => (
                      <li key={m.id}>
                        <strong>{m.order_number}</strong> — {m.customer} · {m.city ?? "—"}
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-muted-foreground mt-2">
                    Use “Geocodificar” e gere as sugestões novamente.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      <EditSuggestionDialog
        suggestion={editing}
        existingRoutes={state?.existingRoutes ?? []}
        onOpenChange={(o) => !o && setEditing(null)}
        onSave={onSaveEdit}
      />

      <ExistingRouteDetailDialog
        route={detailRoute}
        onOpenChange={(o) => !o && setDetailRoute(null)}
      />
    </AppShell>
  );
}

function SuggestionCard({
  suggestion: s,
  depot,
  onConfirm,
  onEdit,
  onDismiss,
  onShowExistingDetail,
  isConfirming,
}: {
  suggestion: RouteSuggestion;
  depot: { lat: number; lng: number } | null;
  onConfirm: () => void;
  onEdit: () => void;
  onDismiss: () => void;
  onShowExistingDetail: () => void;
  isConfirming: boolean;
}) {
  const suggestedDeliveries = new Set(s.stops.map((st) => st.customerId)).size;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              {s.type === "new_route" ? (
                <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-500/30 border">
                  Nova rota
                </Badge>
              ) : (
                <Badge className="bg-blue-500/15 text-blue-700 border-blue-500/30 border">
                  Encaixar existente
                </Badge>
              )}
              {s.routeLabel}
            </CardTitle>
          </div>
          <div className="flex gap-1">
            <Button size="sm" variant="ghost" onClick={onEdit}>
              <Pencil className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="ghost" onClick={onDismiss}>
              <X className="h-4 w-4" />
            </Button>
            <Button size="sm" onClick={onConfirm} disabled={isConfirming}>
              {isConfirming ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4 mr-1" />
              )}
              Confirmar
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {s.type === "append_existing" && (() => {
          const newCustomers = new Set(s.stops.map((st) => st.customerId));
          const newDeliveries = newCustomers.size;
          const totalDeliveries = s.existingDeliveries + newDeliveries;
          const totalWeight = s.existingWeight + s.totalWeight;
          const totalValue = s.existingValue + s.totalAmount;
          return (
            <div className="rounded-md bg-blue-500/5 border border-blue-500/15 px-3 py-2 text-sm space-y-1">
              <button
                type="button"
                onClick={onShowExistingDetail}
                className="text-left w-full hover:underline"
                title="Ver pedidos da rota existente"
              >
                <span className="font-medium text-blue-700">Rota existente:</span>{" "}
                {s.existingDeliveries} entrega(s) · {weightFmt.format(s.existingWeight)} kg ·{" "}
                {currencyFmt.format(s.existingValue)}
              </button>
              <div>
                <span className="font-medium text-emerald-700">Pedidos a inserir:</span>{" "}
                {s.stops.length} pedido(s) · {newDeliveries} entrega(s) ·{" "}
                {weightFmt.format(s.totalWeight)} kg · {currencyFmt.format(s.totalAmount)}
              </div>
              <div className="pt-1 border-t border-blue-500/15">
                <span className="font-medium">Total após encaixe:</span>{" "}
                {totalDeliveries} entrega(s) · {weightFmt.format(totalWeight)} kg ·{" "}
                {currencyFmt.format(totalValue)}
              </div>
            </div>
          );
        })()}
        {s.type === "new_route" && (
          <div className="rounded-md bg-emerald-500/5 border border-emerald-500/15 px-3 py-2 text-sm">
            <span className="font-medium text-emerald-700">Pedidos a inserir:</span>{" "}
            {s.stops.length} pedido(s) · {suggestedDeliveries} entrega(s) ·{" "}
            {weightFmt.format(s.totalWeight)} kg · {currencyFmt.format(s.totalAmount)}
          </div>
        )}
        <SuggestionMap stops={s.stops} depot={depot} />
        <div className="text-sm">
          <ol className="list-decimal list-inside space-y-0.5">
            {s.stops.map((st, i) => (
              <li key={st.orderId}>
                <span className="font-medium">{i + 1}. {st.orderNumber}</span>{" "}
                <span className="text-muted-foreground">
                  — {st.customerName} · {st.city ?? "?"}/{st.state ?? "?"} ·{" "}
                  {weightFmt.format(st.weight)} kg · {currencyFmt.format(st.amount)}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </CardContent>
    </Card>
  );
}

function EditSuggestionDialog({
  suggestion,
  existingRoutes,
  onOpenChange,
  onSave,
}: {
  suggestion: RouteSuggestion | null;
  existingRoutes: ExistingRouteInfo[];
  onOpenChange: (o: boolean) => void;
  onSave: (next: RouteSuggestion) => void;
}) {
  const [draft, setDraft] = useState<RouteSuggestion | null>(null);
  const [original, setOriginal] = useState<RouteSuggestion | null>(null);

  useEffect(() => {
    if (suggestion) {
      setDraft(suggestion);
      setOriginal(suggestion);
    }
  }, [suggestion?.id]);

  const removeStop = (orderId: string) => {
    if (!draft) return;
    const stops = draft.stops.filter((s) => s.orderId !== orderId);
    const totalWeight = stops.reduce((a, s) => a + s.weight, 0);
    const totalAmount = stops.reduce((a, s) => a + s.amount, 0);
    setDraft({
      ...draft,
      stops,
      orderIds: stops.map((s) => s.orderId),
      totalWeight,
      totalAmount,
    });
  };

  return (
    <Dialog open={!!suggestion} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1rem)] max-w-2xl max-h-[calc(100dvh-1rem)] overflow-y-auto overscroll-contain p-0 [touch-action:pan-y] [-webkit-overflow-scrolling:touch] sm:max-h-[90vh]">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle>Editar sugestão</DialogTitle>
        </DialogHeader>
        <div className="px-6 py-3">
          {draft && (
            <div className="space-y-3">
              <div>
                <Label className="text-xs font-semibold">Tipo de rota</Label>
                <div className="mt-1 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    className={cn(
                      "rounded-md border px-3 py-2 text-sm text-center transition-colors",
                      draft.type === "new_route"
                        ? "border-emerald-500 bg-emerald-500/10 text-emerald-700 font-medium"
                        : "border-border bg-background hover:bg-muted"
                    )}
                    onClick={() => {
                      if (draft.type === "new_route") return;
                      setDraft({
                        ...draft,
                        type: "new_route",
                        routeId: null,
                        routeLabel: draft.routeLabel.startsWith("Sugestão")
                          ? draft.routeLabel
                          : `Nova rota — ${draft.routeLabel}`,
                        existingWeight: 0,
                      });
                    }}
                  >
                    Criar nova rota
                  </button>
                  <button
                    type="button"
                    disabled={existingRoutes.length === 0}
                    className={cn(
                      "rounded-md border px-3 py-2 text-sm text-center transition-colors",
                      existingRoutes.length === 0 && "opacity-50 cursor-not-allowed",
                      draft.type === "append_existing"
                        ? "border-blue-500 bg-blue-500/10 text-blue-700 font-medium"
                        : "border-border bg-background hover:bg-muted"
                    )}
                    onClick={() => {
                      if (draft.type === "append_existing") return;
                      const target =
                        original?.type === "append_existing" && original.routeId
                          ? existingRoutes.find((r) => r.id === original.routeId)
                          : existingRoutes[0];
                      const route = target ?? existingRoutes[0];
                      if (!route) return;
                      setDraft({
                        ...draft,
                        type: "append_existing",
                        routeId: route.id,
                        routeLabel: route.label,
                        routeDate: route.date,
                        driverName: route.driverName,
                        existingWeight: route.existingWeight,
                        existingValue: route.existingValue,
                        existingDeliveries: route.existingDeliveries,
                        capacityWeight: route.capacityWeight,
                      });
                    }}
                  >
                    Encaixar existente
                  </button>
                </div>
                {existingRoutes.length === 0 && (
                  <p className="text-xs text-muted-foreground mt-1">Nenhuma rota existente disponível.</p>
                )}
              </div>

              {draft.type === "append_existing" && (
                <div>
                  <Label className="text-xs">Rota existente</Label>
                  <select
                    className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                    value={draft.routeId ?? ""}
                    onChange={(e) => {
                      const r = existingRoutes.find((x) => x.id === e.target.value);
                      if (!r) return;
                      setDraft({
                        ...draft,
                        routeId: r.id,
                        routeLabel: r.label,
                        routeDate: r.date,
                        driverName: r.driverName,
                        existingWeight: r.existingWeight,
                        existingValue: r.existingValue,
                        existingDeliveries: r.existingDeliveries,
                        capacityWeight: r.capacityWeight,
                      });
                    }}
                  >
                    {existingRoutes.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.label} · {r.date.split("-").reverse().join("/")} ·{" "}
                        {weightFmt.format(r.existingWeight)} kg
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <RouteSummaryBlock draft={draft} />

              <div>
                  <Label className="text-xs">Paradas ({draft.stops.length})</Label>
                  <ul className="text-sm divide-y rounded-md border mt-1">
                  {draft.stops.map((s) => (
                    <li key={s.orderId} className="flex items-center justify-between gap-2 px-2 py-1.5">
                      <div>
                        <span className="font-medium">{s.orderNumber}</span>{" "}
                        <span className="text-muted-foreground text-xs">
                          — {s.customerName} · {s.city ?? "?"}/{s.state ?? "?"}
                        </span>
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => removeStop(s.orderId)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
        <DialogFooter className="p-6 pt-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => draft && onSave(draft)}
            disabled={!draft || draft.stops.length === 0}
          >
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RouteSummaryBlock({ draft }: { draft: RouteSuggestion }) {
  const newDeliveries = new Set(draft.stops.map((st) => st.customerId)).size;
  const deliveries = draft.type === "append_existing"
    ? draft.existingDeliveries + newDeliveries
    : newDeliveries;
  const totalWeight = draft.type === "append_existing"
    ? draft.existingWeight + draft.totalWeight
    : draft.totalWeight;
  const totalValue = draft.type === "append_existing"
    ? draft.existingValue + draft.totalAmount
    : draft.totalAmount;

  return (
    <div className="rounded-md bg-blue-500/5 border border-blue-500/15 px-3 py-3 space-y-2">
      <Label className="text-xs font-semibold">Dados consolidados da rota</Label>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <div className="rounded-md border bg-background px-3 py-2">
          <div className="text-xs text-muted-foreground">Entregas</div>
          <div className="text-lg font-semibold">{deliveries}</div>
        </div>
        <div className="rounded-md border bg-background px-3 py-2">
          <div className="text-xs text-muted-foreground">Peso total</div>
          <div className="text-lg font-semibold">{weightFmt.format(totalWeight)} kg</div>
        </div>
        <div className="rounded-md border bg-background px-3 py-2">
          <div className="text-xs text-muted-foreground">Valor total</div>
          <div className="text-lg font-semibold">{currencyFmt.format(totalValue)}</div>
        </div>
      </div>
    </div>
  );
}

function ExistingRouteDetailDialog({
  route,
  onOpenChange,
}: {
  route: { id: string; label: string } | null;
  onOpenChange: (o: boolean) => void;
}) {
  const detail = useQuery({
    queryKey: ["route-detail", route?.id],
    enabled: !!route?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("route_orders")
        .select(
          "stop_order, orders(id, order_number, total_amount, weight, customer_id, customers(trade_name, legal_name, erp_id, city, state))",
        )
        .eq("route_id", route!.id)
        .order("stop_order");
      if (error) throw error;
      return data ?? [];
    },
  });

  type Grouped = {
    customerId: string;
    customerName: string;
    erpId: string | null;
    city: string | null;
    state: string | null;
    orders: { id: string; order_number: string; weight: number; amount: number }[];
    totalWeight: number;
    totalAmount: number;
  };

  const groups: Grouped[] = (() => {
    const rows = detail.data ?? [];
    const map = new Map<string, Grouped>();
    for (const ro of rows) {
      const o = (ro as { orders: unknown }).orders as {
        id: string;
        order_number: string;
        total_amount: number | null;
        weight: number | null;
        customer_id: string | null;
        customers: {
          trade_name: string | null;
          legal_name: string | null;
          erp_id: string | null;
          city: string | null;
          state: string | null;
        } | null;
      } | null;
      if (!o) continue;
      const key = o.customer_id ?? o.id;
      let g = map.get(key);
      if (!g) {
        g = {
          customerId: key,
          customerName: o.customers?.trade_name || o.customers?.legal_name || "Cliente",
          erpId: o.customers?.erp_id ?? null,
          city: o.customers?.city ?? null,
          state: o.customers?.state ?? null,
          orders: [],
          totalWeight: 0,
          totalAmount: 0,
        };
        map.set(key, g);
      }
      const weight = Number(o.weight ?? 0);
      const amount = Number(o.total_amount ?? 0);
      g.orders.push({ id: o.id, order_number: o.order_number, weight, amount });
      g.totalWeight += weight;
      g.totalAmount += amount;
    }
    return Array.from(map.values());
  })();

  const totalWeight = groups.reduce((a, g) => a + g.totalWeight, 0);
  const totalAmount = groups.reduce((a, g) => a + g.totalAmount, 0);
  const totalOrders = groups.reduce((a, g) => a + g.orders.length, 0);

  return (
    <Dialog open={!!route} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1rem)] max-w-2xl max-h-[calc(100dvh-1rem)] overflow-y-auto overscroll-contain p-0 [touch-action:pan-y] [-webkit-overflow-scrolling:touch] sm:max-h-[90vh]">
        <div className="min-h-0">
          <DialogHeader className="p-6 pb-2">
            <DialogTitle>Pedidos da rota — {route?.label}</DialogTitle>
          </DialogHeader>
          <div className="px-6 pb-4">
            {detail.isLoading ? (
              <div className="space-y-2 py-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : groups.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">Nenhum pedido nesta rota.</p>
            ) : (
              <>
                <div className="text-xs text-muted-foreground mb-2">
                  {groups.length} entrega(s) · {totalOrders} pedido(s) ·{" "}
                  {weightFmt.format(totalWeight)} kg · {currencyFmt.format(totalAmount)}
                </div>
                <ul className="space-y-2">
                  {groups.map((g) => (
                    <li key={g.customerId} className="rounded-md border p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-medium text-sm">{g.customerName}{g.erpId ? ` (${g.erpId})` : ""}</div>
                          <div className="text-xs text-muted-foreground">
                            {g.city ?? "?"}/{g.state ?? "?"} · {g.orders.length} pedido(s)
                          </div>
                        </div>
                        <div className="text-xs text-right tabular-nums text-muted-foreground">
                          {weightFmt.format(g.totalWeight)} kg
                          <br />
                          {currencyFmt.format(g.totalAmount)}
                        </div>
                      </div>
                      <ul className="mt-2 text-xs divide-y border-t">
                        {g.orders.map((o) => (
                          <li
                            key={o.id}
                            className="flex items-center justify-between gap-2 py-1"
                          >
                            <span className="font-medium">{o.order_number}</span>
                            <span className="text-muted-foreground tabular-nums">
                              {weightFmt.format(o.weight)} kg ·{" "}
                              {currencyFmt.format(o.amount)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
          <DialogFooter className="border-t bg-background p-4 sm:p-6 sm:pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
