import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Route as RouteIcon, MapPin, Package } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import { AppShell } from "@/components/layout/AppShell";
import { supabase } from "@/integrations/central/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ORDER_STATUS_LABEL, STATUS_TONE, formatCurrency } from "@/lib/orderStatus";

export const Route = createFileRoute("/_authenticated/minhas-rotas")({
  component: MinhasRotasPage,
});

function MinhasRotasPage() {
  const { user } = useAuth();

  const q = useQuery({
    queryKey: ["minhas-rotas", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("routes")
        .select(
          `id, code, route_date, status, notes,
           route_orders(
             id, stop_order,
             orders(
               id, order_number, status, total_amount, sla_deliver_by, notes, erp_cod_cliente, delivery_address
             )
           )`,
        )
        .in("status", ["planejada", "em_andamento"])
        .order("route_date", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <AppShell>
      <div className="space-y-4 max-w-3xl mx-auto">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <RouteIcon className="h-6 w-6" /> Minhas Rotas
          </h1>
          <p className="text-sm text-muted-foreground">
            Rotas atribuídas a você. Toque em um pedido para registrar a entrega.
          </p>
        </div>

        {q.isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : (q.data ?? []).length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              Nenhuma rota ativa atribuída a você.
            </CardContent>
          </Card>
        ) : (
          q.data!.map((r) => {
            const stops = (r.route_orders ?? [])
              .slice()
              .sort((a, b) => (a.stop_order ?? 0) - (b.stop_order ?? 0));
            return (
              <Card key={r.id}>
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start gap-2 flex-wrap">
                    <div>
                      <CardTitle className="text-base">{r.code}</CardTitle>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {format(new Date(r.route_date), "EEEE, dd/MM/yyyy", { locale: ptBR })}
                      </div>
                    </div>
                    <Badge variant={r.status === "em_andamento" ? "default" : "secondary"}>
                      {r.status === "em_andamento" ? "Em andamento" : "Planejada"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {stops.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Sem paradas.</p>
                  ) : (
                    stops.map((s) => {
                      const o = s.orders;
                      if (!o) return null;
                      return (
                        <Link
                          key={s.id}
                          to="/pedidos/$orderId"
                          params={{ orderId: o.id }}
                          className="block border rounded-lg p-3 hover:bg-muted/50 transition"
                        >
                          <div className="flex justify-between items-start gap-2 mb-1">
                            <div className="flex items-center gap-2">
                              <div className="h-6 w-6 rounded-full bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center">
                                {s.stop_order ?? "-"}
                              </div>
                              <div className="font-medium text-sm">
                                <Package className="h-3.5 w-3.5 inline mr-1" />
                                {o.order_number}
                              </div>
                            </div>
                            <span
                              className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] ${STATUS_TONE[o.status]}`}
                            >
                              {ORDER_STATUS_LABEL[o.status]}
                            </span>
                          </div>
                          <div className="text-sm space-y-0.5 ml-8">
                            <div className="font-medium">Cliente {o.erp_cod_cliente ?? "—"}</div>
                            {o.delivery_address ? (
                              <div className="text-xs text-muted-foreground flex items-start gap-1">
                                <MapPin className="h-3 w-3 mt-0.5 shrink-0" />
                                <span>{o.delivery_address}</span>
                              </div>
                            ) : null}
                          </div>
                          <div className="flex justify-between items-center mt-2 ml-8 text-xs">
                            <span className="text-muted-foreground">
                              {o.sla_deliver_by
                                ? `Entregar até ${format(new Date(o.sla_deliver_by), "dd/MM HH:mm")}`
                                : ""}
                            </span>
                            <span className="tabular-nums font-medium">
                              {formatCurrency(Number(o.total_amount))}
                            </span>
                          </div>
                        </Link>
                      );
                    })
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </AppShell>
  );
}
