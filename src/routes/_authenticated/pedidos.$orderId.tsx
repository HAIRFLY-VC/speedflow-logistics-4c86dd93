import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, FileText, MapPin, User } from "lucide-react";

import { AppShell } from "@/components/layout/AppShell";
import { supabase } from "@/integrations/supabase/client";
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
  ORDER_STATUS_LABEL,
  STATUS_TONE,
  formatCurrency,
  type OrderStatus,
} from "@/lib/orderStatus";
import { formatDistanceToNow, format } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/_authenticated/pedidos/$orderId")({
  component: OrderDetailPage,
});

type OrderDetail = {
  id: string;
  order_number: string;
  status: OrderStatus;
  status_since: string;
  total_amount: number;
  freight_amount: number;
  sla_deliver_by: string | null;
  notes: string | null;
  erp_id: string | null;
  created_at: string;
  customers: {
    id: string;
    legal_name: string;
    trade_name: string | null;
    cnpj: string | null;
    contact_name: string | null;
    phone: string | null;
    email: string | null;
    address_line: string | null;
    city: string | null;
    state: string | null;
    zip_code: string | null;
  } | null;
  order_items: Array<{
    id: string;
    quantity: number;
    unit_price: number;
    total_price: number;
    products: { sku: string; name: string } | null;
  }>;
};

type HistoryRow = {
  id: string;
  from_status: OrderStatus | null;
  to_status: OrderStatus;
  changed_at: string;
  note: string | null;
};

function OrderDetailPage() {
  const { orderId } = Route.useParams();

  const orderQ = useQuery({
    queryKey: ["orders", orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select(
          "id,order_number,status,status_since,total_amount,freight_amount,sla_deliver_by,notes,erp_id,created_at,customers(id,legal_name,trade_name,cnpj,contact_name,phone,email,address_line,city,state,zip_code),order_items(id,quantity,unit_price,total_price,products(sku,name))",
        )
        .eq("id", orderId)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as OrderDetail | null;
    },
  });

  const historyQ = useQuery({
    queryKey: ["orders", orderId, "history"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_status_history")
        .select("id,from_status,to_status,changed_at,note")
        .eq("order_id", orderId)
        .order("changed_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as HistoryRow[];
    },
  });

  const order = orderQ.data;
  const subtotal = (order?.order_items ?? []).reduce(
    (s, i) => s + Number(i.total_price ?? 0),
    0,
  );

  return (
    <AppShell>
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link to="/pedidos">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Pedidos
            </Link>
          </Button>
        </div>

        {orderQ.isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : !order ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              Pedido não encontrado.
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold tracking-tight font-mono">
                  #{order.order_number}
                </h1>
                <p className="text-sm text-muted-foreground">
                  Criado em {format(new Date(order.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  {order.erp_id ? ` · ERP: ${order.erp_id}` : ""}
                </p>
              </div>
              <div className="text-right">
                <span
                  className={`inline-flex items-center rounded-md border px-3 py-1 text-sm font-medium ${STATUS_TONE[order.status]}`}
                >
                  {ORDER_STATUS_LABEL[order.status]}
                </span>
                <div className="text-xs text-muted-foreground mt-1">
                  há {formatDistanceToNow(new Date(order.status_since), { locale: ptBR })}
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <User className="h-4 w-4" /> Cliente
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm space-y-1">
                  <div className="font-medium">
                    {order.customers?.trade_name || order.customers?.legal_name || "—"}
                  </div>
                  {order.customers?.trade_name ? (
                    <div className="text-xs text-muted-foreground">
                      {order.customers.legal_name}
                    </div>
                  ) : null}
                  {order.customers?.cnpj ? (
                    <div className="text-xs text-muted-foreground">
                      CNPJ: {order.customers.cnpj}
                    </div>
                  ) : null}
                  {order.customers?.contact_name || order.customers?.phone ? (
                    <div className="text-xs">
                      {order.customers?.contact_name}
                      {order.customers?.phone ? ` · ${order.customers.phone}` : ""}
                    </div>
                  ) : null}
                  {order.customers?.address_line ? (
                    <div className="flex gap-1 text-xs text-muted-foreground items-start mt-1">
                      <MapPin className="h-3 w-3 mt-0.5" />
                      <span>
                        {order.customers.address_line}
                        {order.customers.city ? `, ${order.customers.city}` : ""}
                        {order.customers.state ? `/${order.customers.state}` : ""}
                        {order.customers.zip_code ? ` · ${order.customers.zip_code}` : ""}
                      </span>
                    </div>
                  ) : null}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileText className="h-4 w-4" /> Resumo
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm space-y-1">
                  <Row label="Subtotal" value={formatCurrency(subtotal)} />
                  <Row label="Frete" value={formatCurrency(Number(order.freight_amount))} />
                  <Row
                    label="Total"
                    value={formatCurrency(Number(order.total_amount))}
                    bold
                  />
                  <Row
                    label="SLA"
                    value={
                      order.sla_deliver_by
                        ? format(new Date(order.sla_deliver_by), "dd/MM/yyyy HH:mm", { locale: ptBR })
                        : "—"
                    }
                  />
                </CardContent>
              </Card>
            </div>

            {order.notes ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Observações</CardTitle>
                </CardHeader>
                <CardContent className="text-sm whitespace-pre-wrap">{order.notes}</CardContent>
              </Card>
            ) : null}

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Itens</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>SKU</TableHead>
                      <TableHead>Produto</TableHead>
                      <TableHead className="text-right">Qtd.</TableHead>
                      <TableHead className="text-right">Preço</TableHead>
                      <TableHead className="text-right">Subtotal</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {order.order_items.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                          Sem itens.
                        </TableCell>
                      </TableRow>
                    ) : (
                      order.order_items.map((it) => (
                        <TableRow key={it.id}>
                          <TableCell className="font-mono text-xs">
                            {it.products?.sku || "—"}
                          </TableCell>
                          <TableCell>{it.products?.name || "—"}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {Number(it.quantity)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatCurrency(Number(it.unit_price))}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatCurrency(Number(it.total_price))}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Histórico de status</CardTitle>
              </CardHeader>
              <CardContent>
                {historyQ.isLoading ? (
                  <Skeleton className="h-20 w-full" />
                ) : (historyQ.data ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sem histórico.</p>
                ) : (
                  <ol className="relative border-l ml-2 space-y-4">
                    {historyQ.data!.map((h) => (
                      <li key={h.id} className="ml-4">
                        <div className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full bg-primary" />
                        <div className="flex items-center gap-2 flex-wrap">
                          {h.from_status ? (
                            <>
                              <span
                                className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] ${STATUS_TONE[h.from_status]}`}
                              >
                                {ORDER_STATUS_LABEL[h.from_status]}
                              </span>
                              <span className="text-muted-foreground text-xs">→</span>
                            </>
                          ) : (
                            <span className="text-xs text-muted-foreground">Criado em</span>
                          )}
                          <span
                            className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] ${STATUS_TONE[h.to_status]}`}
                          >
                            {ORDER_STATUS_LABEL[h.to_status]}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {format(new Date(h.changed_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </div>
                        {h.note ? (
                          <div className="text-sm mt-1 text-muted-foreground">{h.note}</div>
                        ) : null}
                      </li>
                    ))}
                  </ol>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AppShell>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={`tabular-nums ${bold ? "font-semibold" : ""}`}>{value}</span>
    </div>
  );
}
