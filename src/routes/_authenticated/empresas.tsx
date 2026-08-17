import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Loader2, Search, Pencil } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/layout/AppShell";
import { supabase } from "@/integrations/central/client";
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
import { consultarCnpj, type ConsultaCnpj } from "@/lib/empresas.functions";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/empresas")({
  component: EmpresasPage,
  head: () => ({
    meta: [
      { title: "Empresas | SpeedFlow Logistics" },
      {
        name: "description",
        content:
          "Cadastro das empresas remetentes detentoras do certificado A1 usadas na captura de CT-e.",
      },
      { property: "og:title", content: "Empresas | SpeedFlow Logistics" },
      {
        property: "og:description",
        content: "Cadastre e edite empresas informando o CNPJ e importe os dados oficiais.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Empresa = Tables<"empresas"> & { cod_erp: string | null };

const formatCnpj = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
};

function EmpresasPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Empresa | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["empresas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("empresas").select("*").order("razao_social");
      if (error) throw error;
      return data as Empresa[];
    },
  });

  const toggle = useMutation({
    mutationFn: async (e: Empresa) => {
      const { error } = await supabase.from("empresas").update({ ativo: !e.ativo }).eq("id", e.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["empresas"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const columns = useMemo<ColumnDef<Empresa>[]>(
    () => [
      {
        id: "razao_social",
        header: "Razão social",
        accessor: (e) => e.razao_social,
        className: "font-medium",
      },
      {
        id: "cnpj",
        header: "CNPJ",
        accessor: (e) => e.cnpj,
        render: (e) => <span className="font-mono text-xs">{formatCnpj(e.cnpj)}</span>,
      },
      {
        id: "ativo",
        header: "Ativa",
        align: "center",
        accessor: (e) => (e.ativo ? "sim" : "não"),
        render: (e) => <Switch checked={e.ativo} onCheckedChange={() => toggle.mutate(e)} />,
      },
      {
        id: "acoes",
        header: "",
        align: "right",
        accessor: () => "",
        render: (e) => (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setEditing(e);
              setOpen(true);
            }}
          >
            <Pencil className="h-4 w-4" />
            <span className="sr-only">Editar</span>
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
            <h1 className="text-2xl font-bold tracking-tight">Empresas</h1>
            <p className="text-muted-foreground text-sm">
              Empresas remetentes (detentoras do certificado A1) consideradas na importação de CT-e.
            </p>
          </div>
          <Button
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-1" /> Nova empresa
          </Button>
        </div>

        <DataTable
          tableKey="empresas"
          columns={columns}
          data={data}
          isLoading={isLoading}
          rowKey={(e) => e.id}
          emptyMessage="Nenhuma empresa cadastrada."
          defaultSort={{ id: "razao_social", dir: "asc" }}
        />
      </div>

      <EmpresaDialog
        open={open}
        onOpenChange={setOpen}
        editing={editing}
        onSaved={() => {
          setOpen(false);
          setEditing(null);
          void qc.invalidateQueries({ queryKey: ["empresas"] });
          void qc.invalidateQueries({ queryKey: ["cte-remetentes-ignorados"] });
        }}
      />
    </AppShell>
  );
}

function EmpresaDialog({
  open,
  onOpenChange,
  editing,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: Empresa | null;
  onSaved: () => void;
}) {
  const consultar = useServerFn(consultarCnpj);
  const [cnpj, setCnpj] = useState("");
  const [razaoSocial, setRazaoSocial] = useState("");
  const [ativo, setAtivo] = useState(true);
  const [dados, setDados] = useState<ConsultaCnpj | null>(null);

  const isEditing = !!editing;

  useEffect(() => {
    if (editing) {
      setCnpj(editing.cnpj);
      setRazaoSocial(editing.razao_social);
      setAtivo(editing.ativo);
      setDados(null);
    } else if (open) {
      setCnpj("");
      setRazaoSocial("");
      setAtivo(true);
      setDados(null);
    }
  }, [editing, open]);

  const buscar = useMutation({
    mutationFn: async () => consultar({ data: { cnpj } }),
    onSuccess: (d) => {
      setDados(d);
      setRazaoSocial(d.razao_social);
    },
    onError: (e: Error) => {
      setDados(null);
      toast.error(e.message);
    },
  });

  const salvar = useMutation({
    mutationFn: async () => {
      if (!isEditing && !dados) throw new Error("Consulte o CNPJ antes de salvar");
      if (isEditing) {
        const { error } = await supabase
          .from("empresas")
          .update({ razao_social: razaoSocial.trim(), ativo })
          .eq("id", editing!.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("empresas")
          .upsert(
            { cnpj: dados!.cnpj, razao_social: dados!.razao_social, ativo: true },
            { onConflict: "cnpj" },
          );
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(isEditing ? "Empresa atualizada" : "Empresa cadastrada");
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) {
          setCnpj("");
          setRazaoSocial("");
          setAtivo(true);
          setDados(null);
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar empresa" : "Nova empresa"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Altere a razão social e o status da empresa."
              : "Informe apenas o CNPJ — os dados cadastrais são importados da base oficial da Receita/SEFAZ."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="cnpj">CNPJ</Label>
            <div className="flex gap-2">
              <Input
                id="cnpj"
                value={formatCnpj(cnpj)}
                onChange={(e) => {
                  setCnpj(e.target.value.replace(/\D/g, "").slice(0, 14));
                  setDados(null);
                }}
                onKeyDown={(e) => {
                  if (!isEditing && e.key === "Enter" && cnpj.length === 14) buscar.mutate();
                }}
                placeholder="00.000.000/0000-00"
                inputMode="numeric"
                disabled={isEditing}
              />
              {!isEditing ? (
                <Button
                  type="button"
                  variant="secondary"
                  disabled={cnpj.length !== 14 || buscar.isPending}
                  onClick={() => buscar.mutate()}
                >
                  {buscar.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                  <span className="ml-1">Buscar</span>
                </Button>
              ) : null}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="razao_social">Razão social</Label>
            <Input
              id="razao_social"
              value={razaoSocial}
              onChange={(e) => setRazaoSocial(e.target.value)}
              placeholder="Razão social da empresa"
            />
          </div>

          <div className="flex items-center gap-2">
            <Switch id="ativo" checked={ativo} onCheckedChange={setAtivo} />
            <Label htmlFor="ativo" className="cursor-pointer">
              Empresa ativa
            </Label>
          </div>

          {dados ? (
            <div className="rounded-md border p-3 text-sm space-y-1">
              <div className="font-medium">{dados.razao_social}</div>
              {dados.nome_fantasia ? (
                <div className="text-muted-foreground">{dados.nome_fantasia}</div>
              ) : null}
              <div className="text-muted-foreground text-xs">
                {[dados.logradouro, dados.municipio, dados.uf].filter(Boolean).join(" · ")}
              </div>
              {dados.situacao ? (
                <div className="text-muted-foreground text-xs">Situação: {dados.situacao}</div>
              ) : null}
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            disabled={!razaoSocial.trim() || salvar.isPending || (!isEditing && !dados)}
            onClick={() => salvar.mutate()}
          >
            {salvar.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
            Salvar empresa
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

