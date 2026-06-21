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
import { Textarea } from "@/components/ui/textarea";
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

export const Route = createFileRoute("/_authenticated/clientes")({
  component: ClientesPage,
});

type Customer = Tables<"customers">;

const customerSchema = z.object({
  legal_name: z.string().trim().min(2, "Mínimo 2 caracteres").max(200),
  trade_name: z.string().trim().max(200).optional().or(z.literal("")),
  cnpj: z.string().trim().max(20).optional().or(z.literal("")),
  contact_name: z.string().trim().max(120).optional().or(z.literal("")),
  email: z.string().trim().email("E-mail inválido").max(255).optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  address_line: z.string().trim().max(255).optional().or(z.literal("")),
  city: z.string().trim().max(120).optional().or(z.literal("")),
  state: z.string().trim().max(2).optional().or(z.literal("")),
  zip_code: z.string().trim().max(15).optional().or(z.literal("")),
  erp_id: z.string().trim().max(60).optional().or(z.literal("")),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
  is_active: z.boolean(),
});
type CustomerInput = z.infer<typeof customerSchema>;

function ClientesPage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Customer | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .order("legal_name");
      if (error) throw error;
      return data as Customer[];
    },
  });

  const upsertMutation = useMutation({
    mutationFn: async (input: CustomerInput) => {
      const payload = normalize(input) as never;
      if (editing) {
        const { error } = await supabase.from("customers").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("customers").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customers"] });
      toast.success(editing ? "Cliente atualizado" : "Cliente criado");
      setDialogOpen(false);
      setEditing(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleActive = useMutation({
    mutationFn: async (c: Customer) => {
      const { error } = await supabase
        .from("customers")
        .update({ is_active: !c.is_active })
        .eq("id", c.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["customers"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  function openEdit(c: Customer) {
    setEditing(c);
    setDialogOpen(true);
  }

  const columns = useMemo<ColumnDef<Customer>[]>(
    () => [
      {
        id: "name",
        header: "Cliente",
        accessor: (c) => c.trade_name || c.legal_name,
        render: (c) => (
          <div>
            <div className="font-medium">{c.trade_name || c.legal_name}</div>
            {c.trade_name ? (
              <div className="text-xs text-muted-foreground">{c.legal_name}</div>
            ) : null}
          </div>
        ),
      },
      {
        id: "cnpj",
        header: "CNPJ",
        accessor: (c) => c.cnpj ?? "",
        className: "font-mono text-xs",
      },
      {
        id: "city",
        header: "Cidade/UF",
        accessor: (c) => (c.city ? `${c.city}${c.state ? "/" + c.state : ""}` : ""),
      },
      {
        id: "contact",
        header: "Contato",
        accessor: (c) => `${c.contact_name ?? ""} ${c.phone ?? ""} ${c.email ?? ""}`,
        render: (c) => (
          <div>
            <div className="text-sm">{c.contact_name || "—"}</div>
            <div className="text-xs text-muted-foreground">{c.phone || c.email}</div>
          </div>
        ),
      },
      {
        id: "active",
        header: "Ativo",
        align: "center",
        accessor: (c) => (c.is_active ? "sim" : "não"),
        render: (c) => (
          <Switch
            checked={c.is_active}
            onCheckedChange={() => toggleActive.mutate(c)}
            aria-label="Ativo"
          />
        ),
      },
      {
        id: "actions",
        header: "",
        sortable: false,
        filterable: false,
        accessor: () => "",
        render: (c) => (
          <Button size="icon" variant="ghost" onClick={() => openEdit(c)}>
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
            <h1 className="text-2xl font-bold tracking-tight">Clientes</h1>
            <p className="text-muted-foreground text-sm">
              Cadastro dos clientes que recebem pedidos.
            </p>
          </div>
          <Button
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-1" />
            Novo cliente
          </Button>
        </div>

        <DataTable
          tableKey="clientes"
          columns={columns}
          data={data}
          isLoading={isLoading}
          rowKey={(c) => c.id}
          emptyMessage="Nenhum cliente encontrado."
          defaultSort={{ id: "name", dir: "asc" }}
        />
      </div>

      <CustomerDialog
        key={editing?.id ?? "new"}
        open={dialogOpen}
        onOpenChange={(o) => {
          setDialogOpen(o);
          if (!o) setEditing(null);
        }}
        editing={editing}
        onSubmit={(v) => upsertMutation.mutate(v)}
        submitting={upsertMutation.isPending}
      />
    </AppShell>
  );
}

function normalize(input: CustomerInput) {
  const out: Record<string, unknown> = { ...input };
  for (const k of Object.keys(out)) {
    if (out[k] === "") out[k] = null;
  }
  return out;
}

function CustomerDialog({
  open,
  onOpenChange,
  editing,
  onSubmit,
  submitting,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: Customer | null;
  onSubmit: (v: CustomerInput) => void;
  submitting: boolean;
}) {
  const form = useForm<CustomerInput>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      legal_name: editing?.legal_name ?? "",
      trade_name: editing?.trade_name ?? "",
      cnpj: editing?.cnpj ?? "",
      contact_name: editing?.contact_name ?? "",
      email: editing?.email ?? "",
      phone: editing?.phone ?? "",
      address_line: editing?.address_line ?? "",
      city: editing?.city ?? "",
      state: editing?.state ?? "",
      zip_code: editing?.zip_code ?? "",
      erp_id: editing?.erp_id ?? "",
      notes: editing?.notes ?? "",
      is_active: editing?.is_active ?? true,
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar cliente" : "Novo cliente"}</DialogTitle>
          <DialogDescription>Dados cadastrais do cliente.</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="grid grid-cols-1 md:grid-cols-2 gap-4"
        >
          <Field label="Razão social *" error={form.formState.errors.legal_name?.message}>
            <Input {...form.register("legal_name")} />
          </Field>
          <Field label="Nome fantasia">
            <Input {...form.register("trade_name")} />
          </Field>
          <Field label="CNPJ">
            <Input {...form.register("cnpj")} />
          </Field>
          <Field label="ID no ERP">
            <Input {...form.register("erp_id")} />
          </Field>
          <Field label="Contato">
            <Input {...form.register("contact_name")} />
          </Field>
          <Field label="Telefone">
            <Input {...form.register("phone")} />
          </Field>
          <Field label="E-mail" error={form.formState.errors.email?.message}>
            <Input type="email" {...form.register("email")} />
          </Field>
          <Field label="CEP">
            <Input {...form.register("zip_code")} />
          </Field>
          <div className="md:col-span-2">
            <Field label="Endereço">
              <Input {...form.register("address_line")} />
            </Field>
          </div>
          <Field label="Cidade">
            <Input {...form.register("city")} />
          </Field>
          <Field label="UF">
            <Input maxLength={2} {...form.register("state")} />
          </Field>
          <div className="md:col-span-2">
            <Field label="Observações">
              <Textarea rows={3} {...form.register("notes")} />
            </Field>
          </div>
          <div className="md:col-span-2 flex items-center gap-3">
            <Switch
              checked={form.watch("is_active")}
              onCheckedChange={(v) => form.setValue("is_active", v)}
              id="is_active"
            />
            <Label htmlFor="is_active">Cliente ativo</Label>
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

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
