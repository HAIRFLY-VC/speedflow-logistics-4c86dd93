import { useMemo, useState } from "react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DataTable, type ColumnDef } from "@/components/data-table/DataTable";
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
    orders: {
      customer_id: string | null;
      order_number: string | null;
      total_amount: number | null;
      weight: number | null;
      erp_status: string | null;
    } | null;
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

function formatRouteDate(value: string | null | undefined): string {
  if (!value) return "";
  const iso = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  const dmy = String(value).match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (dmy) {
    const d = dmy[1].padStart(2, "0");
    const m = dmy[2].padStart(2, "0");
    let y = dmy[3];
    if (y.length === 2) y = `20${y}`;
    return `${d}/${m}/${y}`;
  }
  return String(value);
}

function nomeRotaOf(r: RouteRow) {
  return r.notes?.startsWith("Rota ") ? r.notes.slice(5) : r.code;
}
function motoristaOf(r: RouteRow) {
  return r.driver_name ?? r.freight_carriers?.full_name ?? "";
}
function paradasOf(r: RouteRow) {
  const set = new Set<string>();
  for (const ro of r.route_orders ?? []) {
    if (ro.orders?.customer_id) set.add(ro.orders.customer_id);
  }
  return set.size;
}
function valorOf(r: RouteRow) {
  let total = 0;
  for (const ro of r.route_orders ?? []) total += Number(ro.orders?.total_amount ?? 0);
  return total;
}
function pesoOf(r: RouteRow) {
  let total = 0;
  for (const ro of r.route_orders ?? []) total += Number(ro.orders?.weight ?? 0);
  return total;
}
function statusMapOf(r: RouteRow) {
  const m = new Map<string, Set<string>>();
  for (const ro of r.route_orders ?? []) {
    const o = ro.orders;
    if (!o) continue;
    const st = o.erp_status ?? "—";
    if (!m.has(st)) m.set(st, new Set());
    m.get(st)!.add(o.order_number ?? "");
  }
  return new Map(Array.from(m.entries()).map(([k, v]) => [k, v.size]));
}

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

function StatusList({ map }: { map: Map<string, number> }) {
  const sorted = Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  if (sorted.length === 0) return <span className="text-muted-foreground text-xs">—</span>;
  return (
    <div className="flex flex-col gap-0.5 text-xs">
      {sorted.map(([st, count]) => (
        <div key={st} className="flex items-center justify-between gap-3">
          <span className="font-medium">{st}</span>
          <span className="tabular-nums text-muted-foreground">{count}</span>
        </div>
      ))}
    </div>
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
        );
      if (error) throw error;
      const rows = (data ?? []) as unknown as RouteRow[];
      rows.sort((a, b) => {
        const d = String(a.route_date).localeCompare(String(b.route_date));
        if (d !== 0) return d;
        return nomeRotaOf(a).localeCompare(nomeRotaOf(b), undefined, {
          sensitivity: "base",
        });
      });
      return rows;
    },
  });

  const columns = useMemo<ColumnDef<RouteRow>[]>(
    () => [
      {
        id: "route_date",
        header: "Data planejada",
        sortable: false,
        accessor: (r) => r.route_date,
        render: (r) => (
          <Link
            to="/rotas/$routeId"
            params={{ routeId: r.id }}
            className="text-primary hover:underline"
          >
            {formatRouteDate(r.route_date)}
          </Link>
        ),
      },
      {
        id: "nome_rota",
        header: "Nome da rota",
        sortable: false,
        accessor: (r) => nomeRotaOf(r),
      },
      {
        id: "motorista",
        header: "Motorista",
        sortable: false,
        accessor: (r) => motoristaOf(r),
        render: (r) => motoristaOf(r) || <span className="text-muted-foreground">—</span>,
      },
      {
        id: "paradas",
        header: "Paradas",
        sortable: false,
        align: "right",
        accessor: (r) => paradasOf(r),
        className: "tabular-nums",
        aggregate: (rows) => (
          <span className="tabular-nums">
            {rows.reduce((s, r) => s + paradasOf(r), 0)}
          </span>
        ),
      },
      {
        id: "valor_total",
        header: "Valor total",
        sortable: false,
        align: "right",
        accessor: (r) => valorOf(r),
        render: (r) => currencyFmt.format(valorOf(r)),
        className: "tabular-nums",
        aggregate: (rows) => (
          <span className="tabular-nums">
            {currencyFmt.format(rows.reduce((s, r) => s + valorOf(r), 0))}
          </span>
        ),
      },
      {
        id: "peso_total",
        header: "Peso total (kg)",
        sortable: false,
        align: "right",
        accessor: (r) => pesoOf(r),
        render: (r) => weightFmt.format(pesoOf(r)),
        className: "tabular-nums",
        aggregate: (rows) => (
          <span className="tabular-nums">
            {weightFmt.format(rows.reduce((s, r) => s + pesoOf(r), 0))}
          </span>
        ),
      },
      {
        id: "pedidos_status",
        header: "Pedidos por status",
        sortable: false,
        filterable: false,
        accessor: (r) =>
          Array.from(statusMapOf(r).keys()).join(", "),
        render: (r) => <StatusList map={statusMapOf(r)} />,
        aggregate: (rows) => {
          const agg = new Map<string, number>();
          for (const r of rows) {
            for (const [st, c] of statusMapOf(r)) {
              agg.set(st, (agg.get(st) ?? 0) + c);
            }
          }
          return <StatusList map={agg} />;
        },
      },
      {
        id: "status",
        header: "Status",
        sortable: false,
        accessor: (r) => ROUTE_STATUS_LABEL[r.status],
        render: (r) => (
          <span
            className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${ROUTE_STATUS_TONE[r.status]}`}
          >
            {ROUTE_STATUS_LABEL[r.status]}
          </span>
        ),
      },
    ],
    [],
  );

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

        <DataTable
          tableKey="rotas"
          columns={columns}
          data={data}
          isLoading={isLoading}
          rowKey={(r) => r.id}
          emptyMessage="Nenhuma rota criada."
          defaultSort={{ id: "route_date", dir: "asc" }}
          groupBy={{
            id: "route_date",
            accessor: (r) => r.route_date,
            label: (key) =>
              `Total ${formatRouteDate(key)}`,
          }}
        />
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
