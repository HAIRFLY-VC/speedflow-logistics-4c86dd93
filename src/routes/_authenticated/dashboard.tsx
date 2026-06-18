import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import {
  ORDER_STATUS_LABEL,
  STATUS_TONE,
  formatCurrency,
  isStageLate,
  type OrderStatus,
  type SlaSettings,
} from "@/lib/orderStatus";
import {
  ShoppingCart,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Truck,
  DollarSign,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
});

type OrderRow = {
  id: string;
  status: OrderStatus;
  total_amount: number;
  status_since: string;
  created_at: string;
  sla_deliver_by: string | null;
};

function DashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard", "orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id,status,total_amount,status_since,created_at,sla_deliver_by")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as OrderRow[];
    },
  });

  const slaQ = useQuery({
    queryKey: ["company_settings", "sla"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_settings")
        .select(
          "sla_commercial_approval_hours,sla_credit_approval_hours,sla_fulfillment_hours,sla_delivery_hours",
        )
        .eq("id", 1)
        .maybeSingle();
      if (error) throw error;
      return data as SlaSettings | null;
    },
  });

  const orders = data ?? [];
  const now = Date.now();
  const sla = slaQ.data ?? null;

  const totals = {
    total: orders.length,
    pendingApproval: orders.filter((o) =>
      ["aguardando_aprovacao_comercial", "aguardando_aprovacao_credito"].includes(o.status),
    ).length,
    inTransport: orders.filter((o) => o.status === "em_transporte").length,
    delivered: orders.filter((o) => o.status === "entregue").length,
    atRisk: orders.filter(
      (o) =>
        o.sla_deliver_by &&
        o.status !== "entregue" &&
        o.status !== "cancelado" &&
        new Date(o.sla_deliver_by).getTime() < now,
    ).length,
    stageLate: orders.filter((o) => isStageLate(o.status, o.status_since, sla)).length,
    revenue: orders.reduce((s, o) => s + Number(o.total_amount ?? 0), 0),
  };


  const byStatus = orders.reduce<Record<string, number>>((acc, o) => {
    acc[o.status] = (acc[o.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Visão geral dos pedidos e da operação logística.</p>
        </div>

        <div className="grid gap-4 grid-cols-2 md:grid-cols-4 lg:grid-cols-7">
          <Kpi icon={ShoppingCart} label="Pedidos" value={totals.total} loading={isLoading} />
          <Kpi icon={Clock} label="Aguard. aprovação" value={totals.pendingApproval} loading={isLoading} />
          <Kpi icon={Truck} label="Em transporte" value={totals.inTransport} loading={isLoading} />
          <Kpi icon={CheckCircle2} label="Entregues" value={totals.delivered} loading={isLoading} tone="text-emerald-600" />
          <Kpi icon={AlertTriangle} label="SLA entrega" value={totals.atRisk} loading={isLoading} tone="text-destructive" />
          <Kpi icon={AlertTriangle} label="Etapa atrasada" value={totals.stageLate} loading={isLoading} tone="text-destructive" />
          <Kpi
            icon={DollarSign}
            label="Receita"
            value={formatCurrency(totals.revenue)}
            loading={isLoading}
          />
        </div>


        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pedidos por status</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="grid gap-2 md:grid-cols-2">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-9 w-full" />
                ))}
              </div>
            ) : orders.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum pedido cadastrado ainda. Os indicadores aparecerão aqui assim que houver dados.
              </p>
            ) : (
              <div className="grid gap-2 md:grid-cols-2">
                {(Object.keys(ORDER_STATUS_LABEL) as OrderStatus[]).map((s) => {
                  const count = byStatus[s] ?? 0;
                  const pct = totals.total ? (count / totals.total) * 100 : 0;
                  return (
                    <div key={s} className="flex items-center gap-3">
                      <span
                        className={`inline-flex min-w-[170px] items-center rounded-md border px-2 py-1 text-xs font-medium ${STATUS_TONE[s]}`}
                      >
                        {ORDER_STATUS_LABEL[s]}
                      </span>
                      <div className="flex-1 h-2 rounded bg-muted overflow-hidden">
                        <div
                          className="h-full bg-primary transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-sm tabular-nums w-8 text-right">{count}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  loading,
  tone,
}: {
  icon: typeof ShoppingCart;
  label: string;
  value: string | number;
  loading?: boolean;
  tone?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
          <Icon className={`h-4 w-4 text-muted-foreground ${tone ?? ""}`} />
        </div>
        {loading ? (
          <Skeleton className="h-7 w-20 mt-2" />
        ) : (
          <div className={`mt-1 text-2xl font-semibold tabular-nums ${tone ?? ""}`}>{value}</div>
        )}
      </CardContent>
    </Card>
  );
}
