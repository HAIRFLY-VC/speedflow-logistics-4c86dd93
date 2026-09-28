import { useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { RefreshCw, Loader2 } from "lucide-react";
import { toast } from "@/lib/toast";

import { AppShell } from "@/components/layout/AppShell";
import { supabase } from "@/integrations/central/client";
import { sincronizarResponsaveisErp } from "@/lib/rota-erp.functions";
import { Button } from "@/components/ui/button";
import { DataTable, type ColumnDef } from "@/components/data-table/DataTable";
import type { CentralDatabase } from "@/integrations/central/types";

export const Route = createFileRoute("/_authenticated/fretistas")({
  head: () => ({ meta: [
    { title: "Fretistas — SpeedFlow Logistics" },
    { name: "description", content: "Fretistas cadastrados no ERP que executam as entregas." },
    { property: "og:title", content: "Fretistas — SpeedFlow Logistics" },
    { property: "og:description", content: "Fretistas cadastrados no ERP que executam as entregas." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: FretistasPage,
});

type Responsavel = CentralDatabase["public"]["Tables"]["erp_responsaveis"]["Row"];

function FretistasPage() {
  const qc = useQueryClient();
  const sincronizar = useServerFn(sincronizarResponsaveisErp);

  const { data, isLoading } = useQuery({
    queryKey: ["fretistas-erp"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("erp_responsaveis")
        .select("*")
        .eq("tipo_frete", "F")
        .order("razao_social");
      if (error) throw error;
      return data as Responsavel[];
    },
  });

  const atualizar = useMutation({
    mutationFn: async () => sincronizar(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fretistas-erp"] });
      toast.success("Cadastro de fretistas atualizado a partir do ERP");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const columns = useMemo<ColumnDef<Responsavel>[]>(
    () => [
      {
        id: "cod_erp",
        header: "Código ERP",
        accessor: (r) => r.cod_erp,
        className: "font-mono text-xs",
      },
      {
        id: "razao_social",
        header: "Nome",
        accessor: (r) => r.razao_social ?? "",
        className: "font-medium",
      },
      {
        id: "pix",
        header: "PIX cadastrado",
        align: "center",
        accessor: (r) => (r.pix ? "Sim" : "Não"),
        render: (r) =>
          r.pix ? (
            <span className="text-xs font-medium text-emerald-600">Sim</span>
          ) : (
            <span className="text-xs font-medium text-destructive">Não</span>
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
            <h1 className="text-2xl font-bold tracking-tight">Fretistas</h1>
            <p className="text-muted-foreground text-sm">
              Fretistas cadastrados no ERP que executam as entregas. O cadastro é
              mantido no ERP; use o botão ao lado para buscar alterações.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => atualizar.mutate()}
            disabled={atualizar.isPending}
          >
            {atualizar.isPending ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-1" />
            )}
            Atualizar cadastro
          </Button>
        </div>

        <DataTable
          tableKey="fretistas"
          columns={columns}
          data={data}
          isLoading={isLoading}
          rowKey={(r) => r.cod_erp}
          emptyMessage="Nenhum fretista encontrado no ERP. Clique em “Atualizar cadastro” para sincronizar."
          defaultSort={{ id: "razao_social", dir: "asc" }}
        />
      </div>
    </AppShell>
  );
}
