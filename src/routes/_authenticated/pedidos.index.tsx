import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Search, Trash2, Loader2, Download, AlertTriangle, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { triggerErpSync } from "@/lib/erp.functions";
import { AppShell } from "@/components/layout/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
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
import {
  ORDER_STATUS_LABEL,
  STATUS_TONE,
  formatCurrency,
  isStageLate,
  type OrderStatus,
  type SlaSettings,
} from "@/lib/orderStatus";
import type { Tables } from "@/integrations/supabase/types";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/_authenticated/pedidos/")({
  component: PedidosPage,
});

type OrderRow = {
  id: string;
  order_number: string;
  status: OrderStatus;
  total_amount: number;
  freight_amount: number;
  created_at: string;
  status_since: string | null;
  sla_deliver_by: string | null;
  dt_prev_exp: string | null;
  nome_rota: string | null;
  nome_motorista: string | null;
  customers: { trade_name: string | null; legal_name: string } | null;
};

function PedidosPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "all">("all");
  const [dialogOpen, setDialogOpen] = useState(false);

  const erpSyncFn = useServerFn(triggerErpSync);
  const erpSync = useMutation({
    mutationFn: () => erpSyncFn(),
    onSuccess: async (r) => {
      toast.success(
        `ERP: ${r.created} criado(s), ${r.updated} atualizado(s), ${r.skipped} ignorado(s)` +
          (r.errors.length ? ` — ${r.errors.length} erro(s)` : ""),
      );
      setSearch("");
      setStatusFilter("all");
      await qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["kanban"] });
    },
    onError: (e: Error) => toast.error(`Falha ao importar: ${e.message}`),
  });

  const ordersQ = useQuery({
    queryKey: ["orders", "list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select(
          "id,order_number,status,total_amount,freight_amount,created_at,status_since,sla_deliver_by,customers(trade_name,legal_name)",
        )
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as unknown as OrderRow[];
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
      return (data ?? null) as SlaSettings | null;
    },
  });

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (ordersQ.data ?? []).filter((o) => {
      if (statusFilter !== "all" && o.status !== statusFilter) return false;
      if (!term) return true;
      const name = o.customers?.trade_name || o.customers?.legal_name || "";
      return o.order_number.toLowerCase().includes(term) || name.toLowerCase().includes(term);
    });
  }, [ordersQ.data, search, statusFilter]);

  function exportCsv() {
    const rows = filtered;
    const header = [
      "numero",
      "cliente",
      "status",
      "total",
      "frete",
      "criado_em",
      "sla_entrega",
      "etapa_atrasada",
    ];
    const sla = slaQ.data;
    const escape = (v: unknown) => {
      const s = v === null || v === undefined ? "" : String(v);
      return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [header.join(";")];
    for (const o of rows) {
      const late = isStageLate(o.status, o.status_since, sla);
      lines.push(
        [
          o.order_number,
          o.customers?.trade_name || o.customers?.legal_name || "",
          ORDER_STATUS_LABEL[o.status],
          Number(o.total_amount ?? 0).toFixed(2),
          Number(o.freight_amount ?? 0).toFixed(2),
          new Date(o.created_at).toLocaleString("pt-BR"),
          o.sla_deliver_by ? new Date(o.sla_deliver_by).toLocaleString("pt-BR") : "",
          late ? "sim" : "nao",
        ]
          .map(escape)
          .join(";"),
      );
    }
    const blob = new Blob(["\ufeff" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
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
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Pedidos</h1>
            <p className="text-muted-foreground text-sm">
              Pedidos de venda da indústria até a entrega.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => erpSync.mutate()}
              disabled={erpSync.isPending}
            >
              {erpSync.isPending ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-1" />
              )}
              Importar do ERP
            </Button>
            <Button variant="outline" onClick={exportCsv} disabled={!ordersQ.data?.length}>
              <Download className="h-4 w-4 mr-1" />
              Exportar CSV
            </Button>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Novo pedido
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nº do pedido ou cliente..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
            <SelectTrigger className="w-[240px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              {(Object.keys(ORDER_STATUS_LABEL) as OrderStatus[]).map((s) => (
                <SelectItem key={s} value={s}>
                  {ORDER_STATUS_LABEL[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="border rounded-lg overflow-hidden bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pedido</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Criado</TableHead>
                <TableHead>SLA</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ordersQ.isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={6}>
                      <Skeleton className="h-6 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                    Nenhum pedido encontrado.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((o) => {
                  const slaLate =
                    o.sla_deliver_by &&
                    new Date(o.sla_deliver_by).getTime() < Date.now() &&
                    o.status !== "entregue" &&
                    o.status !== "cancelado";
                  const stageLate = isStageLate(o.status, o.status_since, slaQ.data);
                  return (
                    <TableRow key={o.id} className="cursor-pointer hover:bg-muted/40">
                      <TableCell className="font-mono text-xs">
                        <Link
                          to="/pedidos/$orderId"
                          params={{ orderId: o.id }}
                          className="text-primary hover:underline"
                        >
                          #{o.order_number}
                        </Link>
                      </TableCell>
                      <TableCell>
                        {o.customers?.trade_name || o.customers?.legal_name || "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${STATUS_TONE[o.status]}`}
                          >
                            {ORDER_STATUS_LABEL[o.status]}
                          </span>
                          {stageLate ? (
                            <span className="inline-flex items-center gap-1 rounded-md border border-destructive/40 bg-destructive/10 px-1.5 py-0.5 text-[10px] font-medium text-destructive">
                              <AlertTriangle className="h-3 w-3" />
                              Etapa atrasada
                            </span>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(Number(o.total_amount ?? 0))}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(o.created_at), { addSuffix: true, locale: ptBR })}
                      </TableCell>
                      <TableCell className="text-xs">
                        {o.sla_deliver_by ? (
                          <span className={slaLate ? "text-destructive font-medium" : ""}>
                            {new Date(o.sla_deliver_by).toLocaleDateString("pt-BR")}
                          </span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
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
