import { useState } from "react";
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
import { Input } from "@/components/ui/input";
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

        <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-4">
          {/* Pedidos sem rota */}
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
    </AppShell>
  );
}

function SuggestionCard({
  suggestion: s,
  depot,
  onConfirm,
  onEdit,
  onDismiss,
  isConfirming,
}: {
  suggestion: RouteSuggestion;
  depot: { lat: number; lng: number } | null;
  onConfirm: () => void;
  onEdit: () => void;
  onDismiss: () => void;
  isConfirming: boolean;
}) {
  const pctWeight = s.capacityWeight
    ? Math.round(((s.existingWeight + s.totalWeight) / s.capacityWeight) * 100)
    : 0;
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
            <p className="text-xs text-muted-foreground mt-1">
              Data {s.routeDate.split("-").reverse().join("/")} ·{" "}
              {s.stops.length} parada(s) · {weightFmt.format(s.totalWeight)} kg ·{" "}
              {currencyFmt.format(s.totalAmount)} ·{" "}
              <span className={pctWeight > 100 ? "text-destructive" : ""}>{pctWeight}% cap.</span>
            </p>
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

  if (suggestion && (!draft || draft.id !== suggestion.id)) {
    setDraft(suggestion);
  }

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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden p-0">
        <DialogHeader className="p-6 pb-0 shrink-0">
          <DialogTitle>Editar sugestão</DialogTitle>
        </DialogHeader>
        {draft && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Tipo</Label>
                <select
                  className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                  value={draft.type}
                  onChange={(e) => {
                    const newType = e.target.value as RouteSuggestion["type"];
                    if (newType === draft.type) return;
                    if (newType === "new_route") {
                      setDraft({
                        ...draft,
                        type: "new_route",
                        routeId: null,
                        routeLabel: draft.routeLabel.startsWith("Sugestão")
                          ? draft.routeLabel
                          : `Nova rota — ${draft.routeLabel}`,
                        existingWeight: 0,
                      });
                    } else {
                      const first = existingRoutes[0];
                      if (!first) return;
                      setDraft({
                        ...draft,
                        type: "append_existing",
                        routeId: first.id,
                        routeLabel: first.label,
                        routeDate: first.date,
                        driverName: first.driverName,
                        existingWeight: first.existingWeight,
                        capacityWeight: first.capacityWeight,
                      });
                    }
                  }}
                >
                  <option value="new_route">Criar nova rota</option>
                  <option value="append_existing" disabled={existingRoutes.length === 0}>
                    Encaixar em rota existente
                    {existingRoutes.length === 0 ? " (nenhuma disponível)" : ""}
                  </option>
                </select>
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
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-2">
                <Label className="text-xs">Nome da rota</Label>
                <Input
                  value={draft.routeLabel}
                  onChange={(e) => setDraft({ ...draft, routeLabel: e.target.value })}
                  disabled={draft.type === "append_existing"}
                />
              </div>
              <div>
                <Label className="text-xs">Data planejada</Label>
                <Input
                  type="date"
                  value={draft.routeDate}
                  onChange={(e) => setDraft({ ...draft, routeDate: e.target.value })}
                  disabled={draft.type === "append_existing"}
                />
              </div>
              <div className="md:col-span-3">
                <Label className="text-xs">Motorista</Label>
                <Input
                  value={draft.driverName ?? ""}
                  onChange={(e) => setDraft({ ...draft, driverName: e.target.value || null })}
                  disabled={draft.type === "append_existing"}
                />
              </div>
            </div>


            <div>
              <Label className="text-xs">Paradas ({draft.stops.length})</Label>
              <ul className="text-sm divide-y rounded-md border mt-1 max-h-72 overflow-auto">
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
        <DialogFooter>
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
