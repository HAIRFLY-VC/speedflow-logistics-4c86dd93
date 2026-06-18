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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  freight_carriers: { full_name: string; vehicle_plate: string | null } | null;
  route_orders: { count: number }[];
};

function RotasPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["routes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("routes")
        .select(
          "id,code,route_date,status,total_freight,freight_carriers(full_name,vehicle_plate),route_orders(count)",
        )
        .order("route_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as RouteRow[];
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
                <TableHead>Código</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Fretista</TableHead>
                <TableHead className="text-right">Paradas</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={5}>
                      <Skeleton className="h-6 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : (data ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-10">
                    Nenhuma rota criada.
                  </TableCell>
                </TableRow>
              ) : (
                data!.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs">
                      <Link
                        to="/rotas/$routeId"
                        params={{ routeId: r.id }}
                        className="text-primary hover:underline"
                      >
                        {r.code}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {format(new Date(r.route_date), "dd/MM/yyyy", { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      {r.freight_carriers ? (
                        <>
                          {r.freight_carriers.full_name}
                          {r.freight_carriers.vehicle_plate ? (
                            <span className="text-xs text-muted-foreground">
                              {" · "}
                              {r.freight_carriers.vehicle_plate}
                            </span>
                          ) : null}
                        </>
                      ) : (
                        <span className="text-muted-foreground">Não atribuído</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {r.route_orders?.[0]?.count ?? 0}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${ROUTE_STATUS_TONE[r.status]}`}
                      >
                        {ROUTE_STATUS_LABEL[r.status]}
                      </span>
                    </TableCell>
                  </TableRow>
                ))
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
  const [carrierId, setCarrierId] = useState<string>("");
  const [freight, setFreight] = useState("0");
  const [notes, setNotes] = useState("");

  const carriersQ = useQuery({
    queryKey: ["carriers", "active"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("freight_carriers")
        .select("id,full_name,vehicle_plate")
        .eq("is_active", true)
        .order("full_name");
      if (error) throw error;
      return data;
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const code = `ROT-${routeDate.replace(/-/g, "")}-${Math.floor(Math.random() * 1000)
        .toString()
        .padStart(3, "0")}`;
      const { error } = await supabase.from("routes").insert({
        code,
        route_date: routeDate,
        carrier_id: carrierId || null,
        total_freight: Number(freight || 0),
        notes: notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Rota criada");
      onCreated();
      onOpenChange(false);
      setCarrierId("");
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
          <div className="space-y-1.5">
            <Label className="text-xs">Data da rota *</Label>
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
            <Label className="text-xs">Fretista</Label>
            <Select value={carrierId} onValueChange={setCarrierId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o fretista" />
              </SelectTrigger>
              <SelectContent>
                {(carriersQ.data ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.full_name}
                    {c.vehicle_plate ? ` · ${c.vehicle_plate}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
