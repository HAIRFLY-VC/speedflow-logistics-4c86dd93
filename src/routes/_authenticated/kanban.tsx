import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { supabase } from "@/integrations/supabase/client";
import {
  KANBAN_COLUMNS,
  ORDER_STATUS_LABEL,
  STATUS_TONE,
  formatCurrency,
  isStageLate,
  type OrderStatus,
  type SlaSettings,
} from "@/lib/orderStatus";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";


export const Route = createFileRoute("/_authenticated/kanban")({
  component: KanbanPage,
});

type KanbanOrder = {
  id: string;
  order_number: string;
  status: OrderStatus;
  total_amount: number;
  status_since: string;
  sla_deliver_by: string | null;
  customers: { trade_name: string | null; legal_name: string } | null;
};

function KanbanPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["kanban", "orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select(
          "id,order_number,status,total_amount,status_since,sla_deliver_by,customers(trade_name,legal_name)",
        )
        .order("status_since", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as unknown as KanbanOrder[];
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
  const grouped = KANBAN_COLUMNS.reduce<Record<OrderStatus, KanbanOrder[]>>(

    (acc, s) => {
      acc[s] = [];
      return acc;
    },
    {} as Record<OrderStatus, KanbanOrder[]>,
  );
  for (const o of orders) {
    if (grouped[o.status]) grouped[o.status].push(o);
  }

  return (
    <AppShell>
      <div className="space-y-4 h-full flex flex-col">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Kanban de Pedidos</h1>
          <p className="text-muted-foreground">
            Acompanhe o fluxo dos pedidos da chegada até a entrega.
          </p>
        </div>

        <div className="flex-1 overflow-x-auto pb-2">
          <div className="flex gap-3 min-w-max">
            {KANBAN_COLUMNS.map((status) => {
              const items = grouped[status];
              return (
                <div
                  key={status}
                  className="w-72 shrink-0 rounded-lg border bg-card/40 flex flex-col max-h-[calc(100vh-220px)]"
                >
                  <div className="p-3 border-b flex items-center justify-between sticky top-0 bg-card/80 backdrop-blur rounded-t-lg">
                    <span
                      className={`inline-flex items-center rounded-md border px-2 py-1 text-xs font-medium ${STATUS_TONE[status]}`}
                    >
                      {ORDER_STATUS_LABEL[status]}
                    </span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {items.length}
                    </span>
                  </div>
                  <div className="p-2 space-y-2 overflow-y-auto">
                    {isLoading ? (
                      <>
                        <Skeleton className="h-20 w-full" />
                        <Skeleton className="h-20 w-full" />
                      </>
                    ) : items.length === 0 ? (
                      <p className="text-xs text-muted-foreground px-2 py-6 text-center">
                        Sem pedidos
                      </p>
                    ) : (
                      items.map((o) => <OrderCard key={o.id} order={o} />)
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function OrderCard({ order }: { order: KanbanOrder }) {
  const customer =
    order.customers?.trade_name || order.customers?.legal_name || "Cliente";
  const since = formatDistanceToNow(new Date(order.status_since), {
    addSuffix: true,
    locale: ptBR,
  });
  const slaLate =
    order.sla_deliver_by && new Date(order.sla_deliver_by).getTime() < Date.now();

  return (
    <Card className="hover:border-primary/50 transition-colors cursor-pointer">
      <CardContent className="p-3 space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono text-muted-foreground">#{order.order_number}</span>
          <span className="text-xs font-medium tabular-nums">
            {formatCurrency(Number(order.total_amount ?? 0))}
          </span>
        </div>
        <div className="text-sm font-medium truncate">{customer}</div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{since}</span>
          {slaLate ? (
            <span className="text-destructive font-medium">SLA vencido</span>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
