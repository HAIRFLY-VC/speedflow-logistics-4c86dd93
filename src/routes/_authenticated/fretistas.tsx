import { useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Pencil, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/layout/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DataTable, type ColumnDef } from "@/components/data-table/DataTable";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/fretistas")({
  component: FretistasPage,
});

type Carrier = Tables<"freight_carriers">;

const schema = z.object({
  full_name: z.string().trim().min(2).max(200),
  document: z.string().trim().max(20).optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  vehicle_plate: z.string().trim().max(10).optional().or(z.literal("")),
  vehicle_type: z.string().trim().max(60).optional().or(z.literal("")),
  is_active: z.boolean(),
});
type Input = z.infer<typeof schema>;

function FretistasPage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Carrier | null>(null);
  const [open, setOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["carriers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("freight_carriers")
        .select("*")
        .order("full_name");
      if (error) throw error;
      return data as Carrier[];
    },
  });

  const upsert = useMutation({
    mutationFn: async (input: Input) => {
      const payload = {
        ...input,
        document: input.document || null,
        phone: input.phone || null,
        vehicle_plate: input.vehicle_plate || null,
        vehicle_type: input.vehicle_type || null,
      } as never;
      if (editing) {
        const { error } = await supabase
          .from("freight_carriers")
          .update(payload)
          .eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("freight_carriers").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["carriers"] });
      toast.success(editing ? "Fretista atualizado" : "Fretista criado");
      setOpen(false);
      setEditing(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: async (c: Carrier) => {
      const { error } = await supabase
        .from("freight_carriers")
        .update({ is_active: !c.is_active })
        .eq("id", c.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["carriers"] }),
  });

  const columns = useMemo<ColumnDef<Carrier>[]>(
    () => [
      {
        id: "full_name",
        header: "Nome",
        accessor: (c) => c.full_name,
        className: "font-medium",
      },
      {
        id: "document",
        header: "Documento",
        accessor: (c) => c.document ?? "",
        className: "font-mono text-xs",
      },
      {
        id: "vehicle",
        header: "Veículo",
        accessor: (c) => `${c.vehicle_plate ?? ""} ${c.vehicle_type ?? ""}`.trim(),
        render: (c) =>
          c.vehicle_plate ? (
            <>
              <span className="font-mono">{c.vehicle_plate}</span>
              {c.vehicle_type ? (
                <span className="text-xs text-muted-foreground"> · {c.vehicle_type}</span>
              ) : null}
            </>
          ) : (
            "—"
          ),
      },
      {
        id: "phone",
        header: "Telefone",
        accessor: (c) => c.phone ?? "",
      },
      {
        id: "active",
        header: "Ativo",
        align: "center",
        accessor: (c) => (c.is_active ? "sim" : "não"),
        render: (c) => (
          <Switch checked={c.is_active} onCheckedChange={() => toggle.mutate(c)} />
        ),
      },
      {
        id: "actions",
        header: "",
        sortable: false,
        filterable: false,
        accessor: () => "",
        render: (c) => (
          <Button
            size="icon"
            variant="ghost"
            onClick={() => {
              setEditing(c);
              setOpen(true);
            }}
          >
            <Pencil className="h-4 w-4" />
          </Button>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return (
    <AppShell>
      <div className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Fretistas</h1>
            <p className="text-muted-foreground text-sm">
              Cadastro dos motoristas e veículos que executam entregas.
            </p>
          </div>
          <Button
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-1" /> Novo fretista
          </Button>
        </div>

        <DataTable
          tableKey="fretistas"
          columns={columns}
          data={data}
          isLoading={isLoading}
          rowKey={(c) => c.id}
          emptyMessage="Nenhum fretista cadastrado."
          defaultSort={{ id: "full_name", dir: "asc" }}
        />
      </div>

      <CarrierDialog
        key={editing?.id ?? "new"}
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) setEditing(null);
        }}
        editing={editing}
        onSubmit={(v) => upsert.mutate(v)}
        submitting={upsert.isPending}
      />
    </AppShell>
  );
}

function CarrierDialog({
  open,
  onOpenChange,
  editing,
  onSubmit,
  submitting,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: Carrier | null;
  onSubmit: (v: Input) => void;
  submitting: boolean;
}) {
  const form = useForm<Input>({
    resolver: zodResolver(schema),
    defaultValues: {
      full_name: editing?.full_name ?? "",
      document: editing?.document ?? "",
      phone: editing?.phone ?? "",
      vehicle_plate: editing?.vehicle_plate ?? "",
      vehicle_type: editing?.vehicle_type ?? "",
      is_active: editing?.is_active ?? true,
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Editar fretista" : "Novo fretista"}</DialogTitle>
          <DialogDescription>Dados do motorista e do veículo.</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="grid grid-cols-1 md:grid-cols-2 gap-4"
        >
          <div className="md:col-span-2 space-y-1.5">
            <Label className="text-xs">Nome completo *</Label>
            <Input {...form.register("full_name")} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">CPF / CNPJ</Label>
            <Input {...form.register("document")} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Telefone</Label>
            <Input {...form.register("phone")} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Placa</Label>
            <Input {...form.register("vehicle_plate")} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Tipo de veículo</Label>
            <Input placeholder="Van, VUC, Toco..." {...form.register("vehicle_type")} />
          </div>
          <div className="md:col-span-2 flex items-center gap-3">
            <Switch
              checked={form.watch("is_active")}
              onCheckedChange={(v) => form.setValue("is_active", v)}
              id="active"
            />
            <Label htmlFor="active">Fretista ativo</Label>
          </div>
          <DialogFooter className="md:col-span-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editing ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
