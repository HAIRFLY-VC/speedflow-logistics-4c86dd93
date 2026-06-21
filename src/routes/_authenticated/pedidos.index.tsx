import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Loader2, Download } from "lucide-react";
import { toast } from "sonner";


import { AppShell } from "@/components/layout/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { DataTable, type ColumnDef } from "@/components/data-table/DataTable";
import { formatCurrency, type OrderStatus } from "@/lib/orderStatus";
import type { Tables } from "@/integrations/supabase/types";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/_authenticated/pedidos/")({
  component: PedidosPage,
});

type OrderRow = {
  id: string;
  order_number: string;
  customer_id: string;
  salesperson_id: string | null;
  status: OrderStatus;
  status_since: string;
  total_amount: number;
  freight_amount: number;
  sla_deliver_by: string | null;
  erp_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  dt_prev_exp: string | null;
  nome_rota: string | null;
  nome_motorista: string | null;
  weight: number | null;
  cod_agenda: number | null;
  erp_status: string | null;
  qtd_dias: number | null;
  customers: { trade_name: string | null; legal_name: string; erp_id: string | null } | null;
};

const weightFmt = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });

function customerName(o: OrderRow) {
  return o.customers?.trade_name || o.customers?.legal_name || "";
}

function formatDateBR(v: string | null | undefined) {
  if (!v) return "—";
  const d = new Date(v);
  if (isNaN(d.getTime()) || d.getFullYear() >= 3000) return "—";
  return d.toLocaleDateString("pt-BR");
}

function formatDateTimeBR(v: string | null | undefined) {
  if (!v) return "—";
  const d = new Date(v);
  if (isNaN(d.getTime()) || d.getFullYear() >= 3000) return "—";
  return d.toLocaleString("pt-BR");
}

function formatTempoDias(v: number | string | null | undefined) {
  if (v == null || v === "") return "—";
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : "—";
}

function PedidosPage() {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);

  const ordersQ = useQuery({
    queryKey: ["orders", "list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select(
          "id,order_number,customer_id,salesperson_id,status,status_since,total_amount,freight_amount,sla_deliver_by,erp_id,notes,created_at,updated_at,dt_prev_exp,nome_rota,nome_motorista,weight,cod_agenda,erp_status,qtd_dias,customers(trade_name,legal_name,erp_id)",
        )
        .order("dt_prev_exp", { ascending: true })
        .order("nome_rota", { ascending: true })
        .order("nome_motorista", { ascending: true })
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as unknown as OrderRow[];
    },
  });

  const agendaTotals = useMemo(() => {
    const init = () => ({ valor: 0, peso: 0, qtd: 0 });
    const acc = { a417: init(), a427: init() };
    for (const o of ordersQ.data ?? []) {
      if (o.cod_agenda === 417) {
        acc.a417.valor += Number(o.total_amount ?? 0);
        acc.a417.peso += Number(o.weight ?? 0);
        acc.a417.qtd += 1;
      } else if (o.cod_agenda === 427) {
        acc.a427.valor += Number(o.total_amount ?? 0);
        acc.a427.peso += Number(o.weight ?? 0);
        acc.a427.qtd += 1;
      }
    }
    return {
      pedidos: acc.a417,
      bonificacao: acc.a427,
      total: {
        valor: acc.a417.valor + acc.a427.valor,
        peso: acc.a417.peso + acc.a427.peso,
        qtd: acc.a417.qtd + acc.a427.qtd,
      },
    };
  }, [ordersQ.data]);

  const formatWeight = (kg: number) => `${weightFmt.format(kg)} kg`;

  const columns = useMemo<ColumnDef<OrderRow>[]>(
    () => [
      {
        id: "dt_prev_exp",
        header: "Prev. Exp.",
        accessor: (o) => o.dt_prev_exp ?? "",
        filterType: "date",
        sortable: false,
        render: (o) => formatDateBR(o.dt_prev_exp),
        className: "text-xs text-muted-foreground",
      },
      {
        id: "nome_rota",
        header: "Rota",
        accessor: (o) => o.nome_rota ?? "",
        sortable: false,
        className: "text-xs",
      },
      {
        id: "nome_motorista",
        header: "Motorista",
        accessor: (o) => o.nome_motorista ?? "",
        sortable: false,
        className: "text-xs",
      },
      {
        id: "order_number",
        header: "Pedido",
        accessor: (o) => o.order_number,
        sortable: false,
        render: (o) => (
          <Link
            to="/pedidos/$orderId"
            params={{ orderId: o.id }}
            className="text-primary hover:underline font-mono text-xs"
          >
            {o.order_number}
          </Link>
        ),
      },
      {
        id: "customer",
        header: "Cliente",
        accessor: (o) => customerName(o),
        sortable: false,
      },
      {
        id: "customer_erp_id",
        header: "Cód. Cliente ERP",
        accessor: (o) => o.customers?.erp_id ?? "",
        defaultVisible: false,
        sortable: false,
        className: "text-xs font-mono text-muted-foreground",
      },
      {
        id: "erp_status",
        header: "Status",
        accessor: (o) => o.erp_status ?? "",
        sortable: false,
        className: "text-xs",
      },
      {
        id: "weight",
        header: "Peso",
        align: "right",
        filterType: "number",
        sortable: false,
        accessor: (o) => Number(o.weight ?? 0),
        render: (o) =>
          o.weight ? `${weightFmt.format(Number(o.weight))} kg` : "—",
        className: "tabular-nums text-xs",
      },
      {
        id: "total_amount",
        header: "Total",
        align: "right",
        filterType: "number",
        sortable: false,
        accessor: (o) => Number(o.total_amount ?? 0),
        render: (o) => formatCurrency(Number(o.total_amount ?? 0)),
        className: "tabular-nums",
      },
      {
        id: "created_at",
        header: "Criado",
        accessor: (o) => o.created_at,
        filterType: "date",
        sortable: false,
        filterLabel: (o) => formatDateTimeBR(o.created_at),
        render: (o) =>
          formatDistanceToNow(new Date(o.created_at), {
            addSuffix: true,
            locale: ptBR,
          }),
        className: "text-xs text-muted-foreground",
      },
      {
        id: "id",
        header: "ID",
        accessor: (o) => o.id,
        defaultVisible: false,
        sortable: false,
        className: "text-xs font-mono text-muted-foreground",
      },
      {
        id: "customer_id",
        header: "ID Cliente",
        accessor: (o) => o.customer_id,
        defaultVisible: false,
        sortable: false,
        className: "text-xs font-mono text-muted-foreground",
      },
      {
        id: "salesperson_id",
        header: "ID Vendedor",
        accessor: (o) => o.salesperson_id ?? "",
        defaultVisible: false,
        sortable: false,
        className: "text-xs font-mono text-muted-foreground",
      },
      {
        id: "status",
        header: "Status (sistema)",
        accessor: (o) => o.status ?? "",
        defaultVisible: false,
        sortable: false,
        className: "text-xs",
      },
      {
        id: "status_since",
        header: "Status desde",
        accessor: (o) => o.status_since,
        filterType: "date",
        sortable: false,
        filterLabel: (o) => formatDateTimeBR(o.status_since),
        render: (o) => formatDateTimeBR(o.status_since),
        defaultVisible: false,
        className: "text-xs text-muted-foreground",
      },
      {
        id: "freight_amount",
        header: "Frete",
        align: "right",
        filterType: "number",
        sortable: false,
        accessor: (o) => Number(o.freight_amount ?? 0),
        render: (o) => formatCurrency(Number(o.freight_amount ?? 0)),
        defaultVisible: false,
        className: "tabular-nums",
      },
      {
        id: "sla_deliver_by",
        header: "SLA Entrega",
        accessor: (o) => o.sla_deliver_by ?? "",
        filterType: "date",
        sortable: false,
        filterLabel: (o) => formatDateTimeBR(o.sla_deliver_by),
        render: (o) => formatDateTimeBR(o.sla_deliver_by),
        defaultVisible: false,
        className: "text-xs text-muted-foreground",
      },
      {
        id: "erp_id",
        header: "ERP ID",
        accessor: (o) => o.erp_id ?? "",
        defaultVisible: false,
        sortable: false,
        className: "text-xs font-mono text-muted-foreground",
      },
      {
        id: "cod_agenda",
        header: "Cód. Agenda",
        align: "right",
        filterType: "number",
        sortable: false,
        accessor: (o) => o.cod_agenda ?? 0,
        render: (o) => o.cod_agenda ?? "—",
        defaultVisible: false,
        className: "tabular-nums text-xs",
      },
      {
        id: "notes",
        header: "Observações",
        accessor: (o) => o.notes ?? "",
        defaultVisible: false,
        sortable: false,
        className: "text-xs text-muted-foreground",
      },
      {
        id: "updated_at",
        header: "Atualizado",
        accessor: (o) => o.updated_at,
        filterType: "date",
        sortable: false,
        filterLabel: (o) => formatDateTimeBR(o.updated_at),
        render: (o) => formatDateTimeBR(o.updated_at),
        defaultVisible: false,
        className: "text-xs text-muted-foreground",
      },
      {
        id: "qtd_dias",
        header: "Tempo (d)",
        align: "right",
        filterType: "number",
        sortable: false,
        accessor: (o) => o.qtd_dias ?? "",
        render: (o) => formatTempoDias(o.qtd_dias),
        className: "tabular-nums text-xs",
      },
    ],
    [],
  );

  function exportCsv() {
    const rows = ordersQ.data ?? [];
    const header = ["numero", "cliente", "status", "total", "frete", "peso", "criado_em"];
    const escape = (v: unknown) => {
      const s = v === null || v === undefined ? "" : String(v);
      return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [header.join(";")];
    for (const o of rows) {
      lines.push(
        [
          o.order_number,
          customerName(o),
          o.erp_status || "",
          Number(o.total_amount ?? 0).toFixed(2),
          Number(o.freight_amount ?? 0).toFixed(2),
          Number(o.weight ?? 0).toFixed(2),
          new Date(o.created_at).toLocaleString("pt-BR"),
        ]
          .map(escape)
          .join(";"),
      );
    }
    const blob = new Blob(["\ufeff" + lines.join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pedidos-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${rows.length} pedido(s) exportados`);
  }

  return (
    <AppShell>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pedidos</h1>
          <p className="text-muted-foreground text-sm">
            Pedidos de venda da indústria até a entrega.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { title: "PEDIDOS", data: agendaTotals.pedidos, accent: "border-l-primary" },
            { title: "BONIFICAÇÃO", data: agendaTotals.bonificacao, accent: "border-l-amber-500" },
            { title: "TOTAL", data: agendaTotals.total, accent: "border-l-emerald-500" },
          ].map((c) => (
            <div
              key={c.title}
              className={`rounded-lg border border-l-4 ${c.accent} bg-card p-4 shadow-sm`}
            >
              <p className="text-xs font-semibold tracking-wider text-muted-foreground">
                {c.title}
              </p>
              <p className="mt-2 text-2xl font-bold tabular-nums">
                {formatCurrency(c.data.valor)}
              </p>
              <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  Peso:{" "}
                  <span className="font-medium text-foreground tabular-nums">
                    {formatWeight(c.data.peso)}
                  </span>
                </span>
                <span>
                  Pedidos:{" "}
                  <span className="font-medium text-foreground tabular-nums">
                    {c.data.qtd}
                  </span>
                </span>
              </div>
            </div>
          ))}
        </div>

        <DataTable
          tableKey="pedidos"
          columns={columns}
          data={ordersQ.data}
          isLoading={ordersQ.isLoading}
          rowKey={(o) => o.id}
          emptyMessage="Nenhum pedido encontrado."
          
          toolbarRight={
            <Button
              variant="outline"
              size="sm"
              onClick={exportCsv}
              disabled={!ordersQ.data?.length}
            >
              <Download className="h-4 w-4 mr-1" />
              Exportar CSV
            </Button>
          }
        />
      </div>


      <NewOrderDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={() => {
          qc.invalidateQueries({ queryKey: ["orders"] });
          qc.invalidateQueries({ queryKey: ["dashboard"] });
          qc.invalidateQueries({ queryKey: ["kanban"] });
        }}
      />
    </AppShell>
  );
}

type CustomerOption = Pick<Tables<"customers">, "id" | "legal_name" | "trade_name">;
type ProductOption = Pick<Tables<"products">, "id" | "sku" | "name" | "unit_price">;
type ItemDraft = { id: string; product_id: string; quantity: number; unit_price: number };

function NewOrderDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated: () => void;
}) {
  const [customerId, setCustomerId] = useState("");
  const [sla, setSla] = useState("");
  const [freight, setFreight] = useState("0");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<ItemDraft[]>([]);

  const customersQ = useQuery({
    queryKey: ["customers", "options"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("id,legal_name,trade_name")
        .eq("is_active", true)
        .order("legal_name");
      if (error) throw error;
      return data as CustomerOption[];
    },
  });

  const productsQ = useQuery({
    queryKey: ["products", "options"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id,sku,name,unit_price")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data as ProductOption[];
    },
  });

  function reset() {
    setCustomerId("");
    setSla("");
    setFreight("0");
    setNotes("");
    setItems([]);
  }

  function addItem() {
    setItems((arr) => [
      ...arr,
      { id: crypto.randomUUID(), product_id: "", quantity: 1, unit_price: 0 },
    ]);
  }
  function updateItem(id: string, patch: Partial<ItemDraft>) {
    setItems((arr) => arr.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }
  function removeItem(id: string) {
    setItems((arr) => arr.filter((i) => i.id !== id));
  }

  const subtotal = items.reduce((s, i) => s + i.quantity * i.unit_price, 0);
  const total = subtotal + Number(freight || 0);

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!customerId) throw new Error("Selecione um cliente");
      if (items.length === 0) throw new Error("Adicione pelo menos um item");
      for (const it of items) {
        if (!it.product_id) throw new Error("Selecione o produto de todos os itens");
        if (it.quantity <= 0) throw new Error("Quantidade deve ser maior que zero");
      }
      const order_number = `PED-${new Date()
        .toISOString()
        .slice(0, 10)
        .replace(/-/g, "")}-${Math.floor(Math.random() * 10000)
        .toString()
        .padStart(4, "0")}`;

      const { data: created, error: orderErr } = await supabase
        .from("orders")
        .insert({
          order_number,
          customer_id: customerId,
          freight_amount: Number(freight || 0),
          total_amount: total,
          sla_deliver_by: sla ? new Date(sla).toISOString() : null,
          notes: notes || null,
        })
        .select("id")
        .single();
      if (orderErr) throw orderErr;

      const itemsPayload = items.map((i) => ({
        order_id: created.id,
        product_id: i.product_id,
        quantity: i.quantity,
        unit_price: i.unit_price,
        total_price: i.quantity * i.unit_price,
      }));
      const { error: itemsErr } = await supabase.from("order_items").insert(itemsPayload);
      if (itemsErr) throw itemsErr;
    },
    onSuccess: () => {
      toast.success("Pedido criado");
      onCreated();
      reset();
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo pedido</DialogTitle>
          <DialogDescription>
            O pedido entrará em <strong>Aguardando aprovação comercial</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5 md:col-span-2">
            <Label className="text-xs">Cliente *</Label>
            <Select value={customerId} onValueChange={setCustomerId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o cliente" />
              </SelectTrigger>
              <SelectContent>
                {(customersQ.data ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.trade_name || c.legal_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">SLA de entrega</Label>
            <Input type="datetime-local" value={sla} onChange={(e) => setSla(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Frete (R$)</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={freight}
              onChange={(e) => setFreight(e.target.value)}
            />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label className="text-xs">Observações</Label>
            <Textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2 mt-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm">Itens</Label>
            <Button type="button" variant="outline" size="sm" onClick={addItem}>
              <Plus className="h-4 w-4 mr-1" /> Adicionar item
            </Button>
          </div>

          {items.length === 0 ? (
            <p className="text-xs text-muted-foreground border border-dashed rounded-md py-6 text-center">
              Nenhum item adicionado.
            </p>
          ) : (
            <div className="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produto</TableHead>
                    <TableHead className="w-24 text-right">Qtd.</TableHead>
                    <TableHead className="w-32 text-right">Preço</TableHead>
                    <TableHead className="w-32 text-right">Subtotal</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((it) => {
                    const subtotalLine = it.quantity * it.unit_price;
                    return (
                      <TableRow key={it.id}>
                        <TableCell>
                          <Select
                            value={it.product_id}
                            onValueChange={(pid) => {
                              const p = productsQ.data?.find((x) => x.id === pid);
                              updateItem(it.id, {
                                product_id: pid,
                                unit_price: p ? Number(p.unit_price) : it.unit_price,
                              });
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Produto" />
                            </SelectTrigger>
                            <SelectContent>
                              {(productsQ.data ?? []).map((p) => (
                                <SelectItem key={p.id} value={p.id}>
                                  {p.sku} — {p.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min="1"
                            step="1"
                            value={it.quantity}
                            onChange={(e) =>
                              updateItem(it.id, { quantity: Number(e.target.value || 0) })
                            }
                            className="text-right"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={it.unit_price}
                            onChange={(e) =>
                              updateItem(it.id, { unit_price: Number(e.target.value || 0) })
                            }
                            className="text-right"
                          />
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatCurrency(subtotalLine)}
                        </TableCell>
                        <TableCell>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            onClick={() => removeItem(it.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          <div className="flex justify-end gap-6 text-sm pt-2">
            <div>
              <span className="text-muted-foreground">Subtotal: </span>
              <span className="tabular-nums">{formatCurrency(subtotal)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Frete: </span>
              <span className="tabular-nums">{formatCurrency(Number(freight || 0))}</span>
            </div>
            <div className="font-semibold">
              <span className="text-muted-foreground font-normal">Total: </span>
              <span className="tabular-nums">{formatCurrency(total)}</span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isPending}
          >
            {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Criar pedido
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
