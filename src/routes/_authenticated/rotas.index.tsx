import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

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

export const Route = createFileRoute("/_authenticated/rotas/")({
  component: RotasPage,
});

type RouteRow = {
  id: string;
  code: string;
  route_date: string;
  status: RouteStatus;
  total_freight: number;
  driver_name: string | null;
  notes: string | null;
  freight_carriers: { full_name: string; vehicle_plate: string | null } | null;
  route_orders: {
    orders: { customer_id: string | null; order_number: string | null; total_amount: number | null; weight: number | null; erp_status: string | null } | null;
  }[];
};

const currencyFmt = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});
const weightFmt = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});


function slugify(s: string): string {
  return (
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "rota"
  );
}

function RotasPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["routes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("routes")
        .select(
          "id,code,route_date,status,total_freight,driver_name,notes,freight_carriers(full_name,vehicle_plate),route_orders(orders(customer_id,order_number,total_amount,weight,erp_status))",
        )
        .order("route_date", { ascending: true });
      if (error) throw error;
      const rows = (data ?? []) as unknown as RouteRow[];
      const nameOf = (r: RouteRow) =>
        (r.notes?.startsWith("Rota ") ? r.notes.slice(5) : r.code).toLowerCase();
      return rows.sort((a, b) => {
        if (a.route_date !== b.route_date) return a.route_date < b.route_date ? -1 : 1;
        return nameOf(a).localeCompare(nameOf(b));
      });
    },
  });


  return (
    <AppShell>
      <div className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Rotas</h1>
            <p className="text-muted-foreground text-sm">
              Planeje rotas, atribua pedidos faturados e emita o borderô.
            </p>
          </div>
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Nova rota
          </Button>
        </div>

        <div className="border rounded-lg overflow-hidden bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data planejada</TableHead>
                <TableHead>Nome da rota</TableHead>
                <TableHead>Motorista</TableHead>
                <TableHead className="text-right">Paradas</TableHead>
                <TableHead className="text-right">Valor total</TableHead>
                <TableHead className="text-right">Peso total (kg)</TableHead>
                <TableHead>Pedidos por status</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={8}>
                      <Skeleton className="h-6 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : (data ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-10">
                    Nenhuma rota criada.
                  </TableCell>
                </TableRow>
              ) : (
                (() => {
                  // agrupa por data planejada
                  const groups = new Map<string, RouteRow[]>();
                  for (const r of data!) {
                    const arr = groups.get(r.route_date) ?? [];
                    arr.push(r);
                    groups.set(r.route_date, arr);
                  }
                  const dates = Array.from(groups.keys()).sort();
                  const rows: React.ReactNode[] = [];
                  for (const date of dates) {
                    const group = groups.get(date)!;
                    let groupStops = 0;
                    let groupValor = 0;
                    let groupPeso = 0;
                    const groupStatusMap = new Map<string, number>();
                    for (const r of group) {
                      const motorista =
                        r.driver_name ?? r.freight_carriers?.full_name ?? null;
                      const nomeRota = r.notes?.startsWith("Rota ")
                        ? r.notes.slice(5)
                        : r.code;
                      const clientesUnicos = new Set<string>();
                      let totalValor = 0;
                      let totalPeso = 0;
                      const statusOrders = new Map<string, Set<string>>();
                      for (const ro of r.route_orders ?? []) {
                        const o = ro.orders;
                        if (!o) continue;
                        if (o.customer_id) clientesUnicos.add(o.customer_id);
                        totalValor += Number(o.total_amount ?? 0);
                        totalPeso += Number(o.weight ?? 0);
                        const st = o.erp_status ?? "—";
                        const pedido = o.order_number ?? "";
                        if (!statusOrders.has(st)) statusOrders.set(st, new Set());
                        statusOrders.get(st)!.add(pedido);
                      }
                      const statusMap = new Map<string, number>(
                        Array.from(statusOrders.entries()).map(([st, s]) => [st, s.size]),
                      );
                      const sortedStatus = Array.from(statusMap.entries()).sort((a, b) =>
                        a[0].localeCompare(b[0]),
                      );
                      groupStops += clientesUnicos.size;
                      groupValor += totalValor;
                      groupPeso += totalPeso;
                      for (const [st, count] of statusMap) {
                        groupStatusMap.set(st, (groupStatusMap.get(st) ?? 0) + count);
                      }
                      rows.push(
                        <TableRow key={r.id}>
                          <TableCell>
                            <Link
                              to="/rotas/$routeId"
                              params={{ routeId: r.id }}
                              className="text-primary hover:underline"
                            >
                              {format(new Date(r.route_date), "dd/MM/yyyy", { locale: ptBR })}
                            </Link>
                          </TableCell>
                          <TableCell>{nomeRota}</TableCell>
                          <TableCell>
                            {motorista ?? (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {clientesUnicos.size}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {currencyFmt.format(totalValor)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {weightFmt.format(totalPeso)}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-xs">
                              {Array.from(statusMap.entries()).map(([st, count]) => (
                                <span key={st} className="inline-flex items-center gap-1">
                                  <span className="font-medium">{st}:</span>
                                  <span className="tabular-nums">{count}</span>
                                </span>
                              ))}
                              {statusMap.size === 0 && (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <span
                              className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${ROUTE_STATUS_TONE[r.status]}`}
                            >
                              {ROUTE_STATUS_LABEL[r.status]}
                            </span>
                          </TableCell>
                        </TableRow>
                      );
                    }
                    // linha de total do grupo
                    rows.push(
                      <TableRow key={`total-${date}`} className="bg-muted/50 font-semibold">
                        <TableCell colSpan={3} className="text-muted-foreground text-xs uppercase tracking-wider">
                          Total {format(new Date(date), "dd/MM/yyyy", { locale: ptBR })}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {groupStops}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {currencyFmt.format(groupValor)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {weightFmt.format(groupPeso)}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-xs">
                            {Array.from(groupStatusMap.entries()).map(([st, count]) => (
                              <span key={st} className="inline-flex items-center gap-1">
                                <span className="font-medium">{st}:</span>
                                <span className="tabular-nums">{count}</span>
                              </span>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell />
                      </TableRow>
                    );
                  }
                  return rows;
                })()
              )}
            </TableBody>

          </Table>
        </div>
      </div>

      <NewRouteDialog
        open={open}
        onOpenChange={setOpen}
        onCreated={() => qc.invalidateQueries({ queryKey: ["routes"] })}
      />
    </AppShell>
  );
}

function NewRouteDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated: () => void;
}) {
  const [routeDate, setRouteDate] = useState(new Date().toISOString().slice(0, 10));
  const [routeName, setRouteName] = useState("");
  const [driverName, setDriverName] = useState("");
  const [freight, setFreight] = useState("0");
  const [notes, setNotes] = useState("");

  const create = useMutation({
    mutationFn: async () => {
      if (!routeName.trim()) throw new Error("Informe o nome da rota");
      const code = `${slugify(routeName)}-${routeDate.replace(/-/g, "")}`;
      const { error } = await supabase.from("routes").insert({
        code,
        route_date: routeDate,
        driver_name: driverName.trim() || null,
        total_freight: Number(freight || 0),
        notes: notes.trim() ? notes : `Rota ${routeName.trim()}`,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Rota criada");
      onCreated();
      onOpenChange(false);
      setRouteName("");
      setDriverName("");
      setFreight("0");
      setNotes("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova rota</DialogTitle>
          <DialogDescription>
            Crie a rota e, na próxima tela, atribua pedidos faturados.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5 md:col-span-2">
            <Label className="text-xs">Nome da rota *</Label>
            <Input
              value={routeName}
              onChange={(e) => setRouteName(e.target.value)}
              placeholder="Ex: Rota Centro"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Data planejada de saída *</Label>
            <Input type="date" value={routeDate} onChange={(e) => setRouteDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Frete total (R$)</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={freight}
              onChange={(e) => setFreight(e.target.value)}
            />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label className="text-xs">Motorista</Label>
            <Input
              value={driverName}
              onChange={(e) => setDriverName(e.target.value)}
              placeholder="Nome do motorista"
            />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label className="text-xs">Observações</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => create.mutate()} disabled={create.isPending}>
            {create.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Criar rota
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
