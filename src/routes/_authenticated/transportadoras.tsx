import { useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Pencil, Loader2, Search } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/layout/AppShell";
import { supabase } from "@/integrations/central/client";
import { buscarCodErpTransportadora } from "@/lib/transportadora-erp.functions";
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
import type { CentralDatabase } from "@/integrations/central/types";


export const Route = createFileRoute("/_authenticated/transportadoras")({
  component: TransportadorasPage,
  head: () => ({
    meta: [
      { title: "Transportadoras | SpeedFlow Logistics" },
      {
        name: "description",
        content:
          "Cadastro de transportadoras com CNPJ e dados bancários para auditoria e pagamento de fretes.",
      },
      { property: "og:title", content: "Transportadoras | SpeedFlow Logistics" },
      {
        property: "og:description",
        content: "Cadastro de transportadoras para auditoria e pagamento de fretes.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Transportadora = CentralDatabase["public"]["Tables"]["transportadoras"]["Row"];

const schema = z.object({
  razao_social: z.string().trim().min(2).max(200),
  cnpj: z.string().trim().min(11).max(20),
  cod_erp: z.string().trim().max(40).optional().or(z.literal("")),
  banco: z.string().trim().max(80).optional().or(z.literal("")),
  agencia: z.string().trim().max(20).optional().or(z.literal("")),
  conta: z.string().trim().max(30).optional().or(z.literal("")),
  pix: z.string().trim().max(140).optional().or(z.literal("")),
  ativo: z.boolean(),
});
type FormInput = z.infer<typeof schema>;

function TransportadorasPage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Transportadora | null>(null);
  const [open, setOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["transportadoras"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transportadoras")
        .select("*")
        .order("razao_social");
      if (error) throw error;
      return data as Transportadora[];
    },
  });

  const upsert = useMutation({
    mutationFn: async (input: FormInput) => {
      const payload = {
        razao_social: input.razao_social,
        cnpj: input.cnpj.replace(/\D/g, ""),
        cod_erp: input.cod_erp || null,
        banco: input.banco || null,
        agencia: input.agencia || null,
        conta: input.conta || null,
        pix: input.pix || null,
        ativo: input.ativo,
      };
      if (editing) {
        const { error } = await supabase
          .from("transportadoras")
          .update(payload)
          .eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("transportadoras").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transportadoras"] });
      toast.success(editing ? "Transportadora atualizada" : "Transportadora criada");
      setOpen(false);
      setEditing(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: async (t: Transportadora) => {
      const { error } = await supabase
        .from("transportadoras")
        .update({ ativo: !t.ativo })
        .eq("id", t.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["transportadoras"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const buscarCodErp = useServerFn(buscarCodErpTransportadora);
  const [buscandoId, setBuscandoId] = useState<string | null>(null);

  const consultarErp = useMutation({
    mutationFn: async (t: Transportadora) => {
      setBuscandoId(t.id);
      const { codErp } = await buscarCodErp({ data: { cnpj: t.cnpj } });
      if (!codErp) return { codErp: null as string | null };
      const { error } = await supabase
        .from("transportadoras")
        .update({ cod_erp: codErp })
        .eq("id", t.id);
      if (error) throw error;
      return { codErp };
    },
    onSuccess: (r) => {
      setBuscandoId(null);
      if (r.codErp) {
        qc.invalidateQueries({ queryKey: ["transportadoras"] });
        toast.success(`Código no ERP: ${r.codErp}`);
      } else {
        toast.warning("Nenhum código encontrado no ERP para este CNPJ");
      }
    },
    onError: (e: Error) => {
      setBuscandoId(null);
      toast.error(e.message);
    },
  });

  const columns = useMemo<ColumnDef<Transportadora>[]>(
    () => [
      {
        id: "razao_social",
        header: "Razão social",
        accessor: (t) => t.razao_social,
        className: "font-medium",
      },
      {
        id: "cnpj",
        header: "CNPJ",
        accessor: (t) => t.cnpj,
        className: "font-mono text-xs",
      },
      {
        id: "cod_erp",
        header: "Cód. ERP",
        accessor: (t) => t.cod_erp ?? "",
        render: (t) => (
          <span className="flex items-center gap-1">
            {t.cod_erp ? (
              <span className="font-mono text-xs">{t.cod_erp}</span>
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6"
              title="Consultar código no ERP"
              disabled={buscandoId === t.id}
              onClick={() => consultarErp.mutate(t)}
            >
              {buscandoId === t.id ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Search className="h-3 w-3" />
              )}
            </Button>
          </span>
        ),
      },

      {
        id: "banco",
        header: "Banco",
        accessor: (t) => t.banco ?? "",
        render: (t) =>
          t.banco ? (
            <>
              <span>{t.banco}</span>
              <span className="text-xs text-muted-foreground">
                {t.agencia ? ` · Ag ${t.agencia}` : ""}
                {t.conta ? ` · CC ${t.conta}` : ""}
              </span>
            </>
          ) : (
            "—"
          ),
      },
      { id: "pix", header: "PIX", accessor: (t) => t.pix ?? "" },
      {
        id: "ativo",
        header: "Ativo",
        align: "center",
        accessor: (t) => (t.ativo ? "sim" : "não"),
        render: (t) => <Switch checked={t.ativo} onCheckedChange={() => toggle.mutate(t)} />,
      },
      {
        id: "actions",
        header: "",
        sortable: false,
        filterable: false,
        accessor: () => "",
        render: (t) => (
          <Button
            size="icon"
            variant="ghost"
            onClick={() => {
              setEditing(t);
              setOpen(true);
            }}
          >
            <Pencil className="h-4 w-4" />
          </Button>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [buscandoId],

  );

  return (
    <AppShell>
      <div className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Transportadoras</h1>
            <p className="text-muted-foreground text-sm">
              Cadastro das transportadoras emissoras de CT-e e seus dados de pagamento.
            </p>
          </div>
          <Button
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-1" /> Nova transportadora
          </Button>
        </div>

        <DataTable
          tableKey="transportadoras"
          columns={columns}
          data={data}
          isLoading={isLoading}
          rowKey={(t) => t.id}
          emptyMessage="Nenhuma transportadora cadastrada."
          defaultSort={{ id: "razao_social", dir: "asc" }}
        />
      </div>

      <TransportadoraDialog
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

function TransportadoraDialog({
  open,
  onOpenChange,
  editing,
  onSubmit,
  submitting,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: Transportadora | null;
  onSubmit: (v: FormInput) => void;
  submitting: boolean;
}) {
  const buscarCodErp = useServerFn(buscarCodErpTransportadora);
  const [consultando, setConsultando] = useState(false);
  const form = useForm<FormInput>({

    resolver: zodResolver(schema),
    defaultValues: {
      razao_social: editing?.razao_social ?? "",
      cnpj: editing?.cnpj ?? "",
      banco: editing?.banco ?? "",
      agencia: editing?.agencia ?? "",
      conta: editing?.conta ?? "",
      cod_erp: editing?.cod_erp ?? "",
      pix: editing?.pix ?? "",
      ativo: editing?.ativo ?? true,
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {editing ? "Editar transportadora" : "Nova transportadora"}
          </DialogTitle>
          <DialogDescription>Identificação e dados bancários.</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="grid grid-cols-1 md:grid-cols-2 gap-4"
        >
          <div className="md:col-span-2 space-y-1.5">
            <Label className="text-xs">Razão social *</Label>
            <Input {...form.register("razao_social")} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">CNPJ *</Label>
            <Input {...form.register("cnpj")} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Código no ERP</Label>
            <div className="flex gap-2">
              <Input {...form.register("cod_erp")} placeholder="Ex.: 1234" />
              <Button
                type="button"
                variant="outline"
                size="icon"
                title="Consultar no ERP pelo CNPJ"
                disabled={consultando}
                onClick={async () => {
                  const cnpj = form.getValues("cnpj");
                  if (!cnpj) return toast.error("Informe o CNPJ primeiro");
                  setConsultando(true);
                  try {
                    const { codErp } = await buscarCodErp({ data: { cnpj } });
                    if (codErp) {
                      form.setValue("cod_erp", codErp, { shouldDirty: true });
                      toast.success(`Código no ERP: ${codErp}`);
                    } else {
                      toast.warning("Nenhum código encontrado no ERP para este CNPJ");
                    }
                  } catch (e) {
                    toast.error((e as Error).message);
                  } finally {
                    setConsultando(false);
                  }
                }}
              >
                {consultando ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Banco</Label>
            <Input {...form.register("banco")} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Agência</Label>
            <Input {...form.register("agencia")} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Conta</Label>
            <Input {...form.register("conta")} />
          </div>
          <div className="md:col-span-2 space-y-1.5">
            <Label className="text-xs">Chave PIX</Label>
            <Input {...form.register("pix")} />
          </div>
          <div className="md:col-span-2 flex items-center gap-3">
            <Switch
              id="ativo"
              checked={form.watch("ativo")}
              onCheckedChange={(v) => form.setValue("ativo", v)}
            />
            <Label htmlFor="ativo">Transportadora ativa</Label>
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
